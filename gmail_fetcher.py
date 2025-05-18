import os
import logging
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from base64 import urlsafe_b64decode
import email
from flask import session
import re
import requests
import time
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_company_logo(email_domain):
    """Get company logo URL using Clearbit's Logo API for a given email domain."""
    try:
        # Extract domain from email
        domain = email_domain.split('@')[-1]
        # Use Clearbit's Logo API
        response = requests.get(f'https://logo.clearbit.com/{domain}', timeout=2)
        if response.status_code == 200:
            return f'https://logo.clearbit.com/{domain}'
    except Exception as e:
        logger.error(f"Error getting company logo: {e}")
    return None

def extract_email_address(email_string):
    """Extract email address from a string that might contain a name."""
    match = re.search(r'[\w\.-]+@[\w\.-]+', email_string)
    return match.group(0) if match else None

def get_profile_photo(service, email_address):
    """Get profile photo URL for a given email address using People API."""
    try:
        # Search for the person by email
        results = service.people().connections().list(
            resourceName='people/me',
            pageSize=100,
            personFields='photos,emailAddresses'
        ).execute()

        # Look for the person in connections
        if 'connections' in results:
            for person in results['connections']:
                if 'emailAddresses' in person:
                    for email_info in person['emailAddresses']:
                        if email_info.get('value', '').lower() == email_address.lower():
                            # Found the person, get their photo
                            if 'photos' in person and person['photos']:
                                # Prefer the primary, non-default photo
                                for photo in person['photos']:
                                    if photo.get('metadata', {}).get('primary') and not photo.get('default', False):
                                        return photo.get('url')
                                # Fallback to the first photo if no primary found
                                return person['photos'][0].get('url')
    except Exception as e:
        logger.error(f"Error getting profile photo: {e}")
    return None

def get_gmail_service():
    """Gets an authorized Gmail API service instance using session credentials."""
    creds = None

    # Use credentials from Flask session if available
    token_data = session.get('google_token')
    if token_data:
        creds = Credentials(
            token=token_data['token'],
            refresh_token=token_data.get('refresh_token'),
            token_uri=token_data['token_uri'],
            client_id=token_data['client_id'],
            client_secret=token_data['client_secret'],
            scopes=token_data['scopes']
        )
        # Refresh if needed
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
    else:
        raise Exception("No Google credentials in session. Please log in with Google.")

    return build('gmail', 'v1', credentials=creds), build('people', 'v1', credentials=creds)

def extract_best_body(part):
    """Recursively extract the best body part (prefer html, fallback to plain)."""
    if part.get('mimeType') == 'text/html' and 'data' in part.get('body', {}):
        return urlsafe_b64decode(part['body']['data']).decode(errors='replace'), 'html'
    if part.get('mimeType') == 'text/plain' and 'data' in part.get('body', {}):
        return urlsafe_b64decode(part['body']['data']).decode(errors='replace'), 'plain'
    if 'parts' in part:
        html_body = None
        plain_body = None
        for subpart in part['parts']:
            body, body_type = extract_best_body(subpart)
            if body_type == 'html' and body:
                return body, 'html'
            elif body_type == 'plain' and body and not plain_body:
                plain_body = body
        if plain_body:
            return plain_body, 'plain'
    return '', 'plain'

def get_email_content(message):
    """Extract all useful fields from the message."""
    if 'payload' not in message:
        return None

    payload = message['payload']
    headers = payload.get('headers', [])

    # Convert headers to a dict for easy access
    header_dict = {h['name'].lower(): h['value'] for h in headers}

    # Recipients
    to = header_dict.get('to', '')
    cc = header_dict.get('cc', '')
    bcc = header_dict.get('bcc', '')
    date = header_dict.get('date', '')
    subject = header_dict.get('subject', 'No Subject')
    from_header = header_dict.get('from', 'Unknown Sender')

    # Extract sender name and email from the From header
    sender = from_header
    sender_email = None
    if '<' in from_header and '>' in from_header:
        # Extract name from "Name <email@example.com>" format
        sender = from_header.split('<')[0].strip()
        sender_email = from_header.split('<')[1].split('>')[0]
    else:
        sender_email = extract_email_address(from_header)

    # Recursively get the best body part
    body, body_type = extract_best_body(payload)

    # Attachments
    attachments = []
    def find_attachments(part):
        if part.get('filename'):
            if 'attachmentId' in part.get('body', {}):
                attachments.append({
                    'filename': part['filename'],
                    'mimeType': part.get('mimeType'),
                    'size': part['body'].get('size'),
                    'attachmentId': part['body']['attachmentId']
                })
        for subpart in part.get('parts', []):
            find_attachments(subpart)
    find_attachments(payload)

    return {
        'id': message.get('id'),
        'threadId': message.get('threadId'),
        'labelIds': message.get('labelIds', []),
        'snippet': message.get('snippet', ''),
        'historyId': message.get('historyId'),
        'internalDate': message.get('internalDate'),
        'sizeEstimate': message.get('sizeEstimate'),
        'headers': header_dict,
        'from': from_header,  # Keep the full From header
        'sender': sender,     # Add the extracted sender name
        'sender_email': sender_email,  # Add the sender's email
        'to': to,
        'cc': cc,
        'bcc': bcc,
        'date': date,
        'subject': subject,
        'body': body,
        'body_type': body_type,
        'attachments': attachments
    }

def start_watch(service):
    """Start watching for Gmail notifications using Pub/Sub."""
    try:
        # Get topic name from environment variable
        topic_name = os.getenv('GMAIL_NOTIFICATION_TOPIC')
        if not topic_name:
            logger.warning("Warning: GMAIL_NOTIFICATION_TOPIC not set, using polling only")
            return None

        # Start watching the user's inbox
        request = {
            'labelIds': ['INBOX'],
            'topicName': topic_name
        }
        response = service.users().watch(userId='me', body=request).execute()
        logger.info(f"Started watching for new emails. Expiration: {response.get('expiration')}")
        return response
    except Exception as e:
        logger.error(f"Error starting watch: {e}")
        return None

def stop_watch(service):
    """Stop watching for Gmail notifications."""
    try:
        service.users().stop(userId='me').execute()
    except Exception as e:
        logger.error(f"Error stopping watch: {e}")

def get_history_id(service):
    """Get the current history ID for the user."""
    try:
        profile = service.users().getProfile(userId='me').execute()
        return profile.get('historyId')
    except Exception as e:
        logger.error(f"Error getting history ID: {e}")
        return None

def get_new_emails(service, history_id):
    """Get new emails since the last history ID."""
    try:
        # Get history list
        history_list = service.users().history().list(
            userId='me',
            startHistoryId=history_id,
            historyTypes=['messageAdded']
        ).execute()

        new_emails = []
        if 'history' in history_list:
            for history in history_list['history']:
                if 'messagesAdded' in history:
                    for message_added in history['messagesAdded']:
                        message = message_added['message']
                        if message['labelIds'] and 'INBOX' in message['labelIds']:
                            # Get full message details
                            msg = service.users().messages().get(
                                userId='me',
                                id=message['id']
                            ).execute()
                            email_content = get_email_content(msg)
                            if email_content:
                                new_emails.append(email_content)

        return new_emails
    except Exception as e:
        logger.error(f"Error getting new emails: {e}")
        return []

def fetch_emails(max_results=10):
    """Fetch emails from Gmail and enrich with sender photo or company logo."""
    try:
        gmail_service, people_service = get_gmail_service()
        
        # Get list of messages
        results = gmail_service.users().messages().list(
            userId='me', maxResults=max_results).execute()
        messages = results.get('messages', [])
        
        if not messages:
            logger.info('No messages found.')
            return []
        
        logger.info(f'Found {len(messages)} messages.')
        
        # Fetch each message
        email_list = []
        for message in messages:
            msg = gmail_service.users().messages().get(
                userId='me', id=message['id']).execute()
            
            email_content = get_email_content(msg)
            if email_content:
                # Try to get profile photo for the sender
                if email_content['sender_email']:
                    # First try to get Google profile photo
                    photo_url = get_profile_photo(people_service, email_content['sender_email'])
                    if photo_url:
                        email_content['sender_photo'] = photo_url
                    else:
                        # If no Google photo, try to get company logo
                        company_logo = get_company_logo(email_content['sender_email'])
                        if company_logo:
                            email_content['sender_photo'] = company_logo
                
                email_list.append(email_content)
                logger.info('\n' + '='*50)
                logger.info(f'From: {email_content["sender"]}')
                logger.info(f'Subject: {email_content["subject"]}')
                logger.info('-'*50)
                logger.info(f'Body: {email_content["body"][:200]}...')  # Show first 200 chars
                logger.info('='*50)
        
        # Start watching for new emails
        watch_response = start_watch(gmail_service)
        if watch_response:
            logger.info(f"Started watching for new emails. Expiration: {watch_response.get('expiration')}")
        
        return email_list
    
    except Exception as e:
        logger.error(f'An error occurred: {e}')
        raise e

if __name__ == '__main__':
    fetch_emails() 