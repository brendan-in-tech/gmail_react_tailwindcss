from flask import Flask, jsonify, request, session, redirect, url_for
from flask_cors import CORS
from gmail_fetcher import fetch_emails, get_gmail_service, get_history_id, get_new_emails
import logging
import os
from google_auth_oauthlib.flow import Flow
import google.auth.transport.requests
import requests as ext_requests
import googleapiclient.discovery
from flask_session import Session
from flask_wtf import CSRFProtect

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'supersecretkey')
app.config['SESSION_TYPE'] = os.getenv('SESSION_TYPE', 'filesystem')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
Session(app)
CSRFProtect(app)

# Enable CORS for all domains on all routes
CORS(app, 
     resources={r"/*": {
         "origins": [os.getenv('FRONTEND_URL', 'http://localhost:5173')],
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type"]
     }},
     supports_credentials=True)

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin == "http://localhost:5173":
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

@app.route('/')
def home():
    logger.debug("Received request to /")
    return jsonify({"status": "Server is running"})

# Demo user
DEMO_USER = {
    'email': 'test@example.com',
    'password': 'password123',
    'name': 'Test User'
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    if email == DEMO_USER['email'] and password == DEMO_USER['password']:
        session['user'] = {'email': DEMO_USER['email'], 'name': DEMO_USER['name']}
        return jsonify({'message': 'Login successful', 'user': session['user']})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'message': 'Logged out'})

@app.route('/me', methods=['GET'])
def me():
    user = session.get('user')
    if user:
        return jsonify({'user': user})
    return jsonify({'user': None}), 401

@app.route('/fetch-emails')
def get_emails():
    logger.debug("Received request to /fetch-emails")
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        emails = fetch_emails()
        logger.debug(f"Successfully fetched {len(emails)} emails")
        return jsonify(emails)
    except Exception as e:
        logger.error(f"Error fetching emails: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/check-new-emails')
def check_new_emails():
    """Check for new emails since last check."""
    logger.debug("Received request to /check-new-emails")
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        gmail_service, _ = get_gmail_service()
        
        # Get the last history ID from session or get current one
        last_history_id = session.get('last_history_id')
        if not last_history_id:
            last_history_id = get_history_id(gmail_service)
            session['last_history_id'] = last_history_id
        
        # Get new emails
        new_emails = get_new_emails(gmail_service, last_history_id)
        
        # Update last history ID
        if new_emails:
            current_history_id = get_history_id(gmail_service)
            session['last_history_id'] = current_history_id
        
        return jsonify({
            'new_emails': new_emails,
            'has_new': len(new_emails) > 0
        })
    except Exception as e:
        logger.error(f"Error checking new emails: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Google OAuth config
GOOGLE_CLIENT_SECRETS_FILE = 'credentials.json'
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/contacts.readonly'  # Added People API scope
]
REDIRECT_URI = 'http://localhost:5001/login/google/callback'
LOGIN_URL = 'http://localhost:5001/login'
FRONTEND_URL = 'http://localhost:5173/'
REFRESH_TOKEN_URL = 'http://localhost:5001/refresh-token'

@app.route('/login/google')
def login_google():
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRETS_FILE,
        scopes=GOOGLE_SCOPES,
        redirect_uri=REDIRECT_URI
    )
    auth_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    session['oauth_state'] = state
    return redirect(auth_url)

@app.route('/login/google/callback')
def login_google_callback():
    state = session.get('oauth_state')
    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRETS_FILE,
        scopes=GOOGLE_SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI
    )
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    session['google_token'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }
    # Get user info
    userinfo_response = ext_requests.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        headers={'Authorization': f'Bearer {credentials.token}'}
    )
    userinfo = userinfo_response.json()
    # Fetch Google profile photo using People API
    people_service = googleapiclient.discovery.build('people', 'v1', credentials=credentials)
    profile = people_service.people().get(
        resourceName='people/me',
        personFields='photos'
    ).execute()
    photo_url = None
    if 'photos' in profile and profile['photos']:
        # Prefer the primary, non-default photo
        for photo in profile['photos']:
            if photo.get('metadata', {}).get('primary') and not photo.get('default', False):
                photo_url = photo.get('url')
                break
        # Fallback to the first photo if no primary found
        if not photo_url:
            photo_url = profile['photos'][0].get('url')
    session['user'] = {
        'email': userinfo.get('email'),
        'name': userinfo.get('name', userinfo.get('email')),
        'photo': photo_url
    }
    return redirect(FRONTEND_URL)

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    debug = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(debug=debug, port=5001, host='0.0.0.0') 