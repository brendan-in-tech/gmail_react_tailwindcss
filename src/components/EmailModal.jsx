import React from 'react'
import { XMarkIcon, PaperAirplaneIcon, ClockIcon } from '@heroicons/react/24/outline'
import DOMPurify from 'dompurify'

function EmailModal({ email, onClose }) {
  if (!email) return null

  // Format the date if available
  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })
  }

  // Detect if the body is HTML
  const isHtml = (body) => {
    return /<([a-z][\s\S]*?)>/i.test(body)
  }

  // Convert URLs in plain text to clickable links and render images for image URLs
  const linkifyWithImages = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const imageRegex = /\.(jpeg|jpg|gif|png|webp|svg)$/i
    return text.split('\n').map((line, i) =>
      <span key={i}>
        {line.split(urlRegex).map((part, j) => {
          if (urlRegex.test(part)) {
            if (imageRegex.test(part)) {
              return (
                <div key={j} className="my-2">
                  <img src={part} alt="email content" className="max-w-full max-h-64 rounded shadow border" />
                </div>
              )
            } else {
              return <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a>
            }
          }
          return part
        })}
        <br />
      </span>
    )
  }

  // Gmail-like body style overrides
  const gmailBodyStyles = {
    fontFamily: 'Roboto, Arial, sans-serif',
    background: '#fcfcfc',
    borderRadius: '8px',
    padding: '24px',
    color: '#222',
    fontSize: '16px',
    lineHeight: '1.7',
    boxShadow: '0 1px 2px rgba(60,64,67,.08)',
    border: '1px solid #f1f3f4',
    margin: 0
  }

  // Gmail-like HTML overrides for blockquotes, links, etc.
  const gmailHtml = (html) => {
    // Add Gmail-like styles for blockquotes, links, images
    return html.replace(
      /<blockquote/gi,
      '<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:2px solid #e0e0e0;color:#666;font-style:italic;"'
    ).replace(
      /<a /gi,
      '<a style="color:#1a73e8;text-decoration:underline;word-break:break-all;" '
    ).replace(
      /<img /gi,
      '<img style="max-width:100%;border-radius:6px;box-shadow:0 1px 2px rgba(60,64,67,.08);margin:8px 0;" '
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center bg-white" style={{minHeight:'64px'}}>
          <div className="flex items-center space-x-3">
            {email.sender_photo ? (
              <img
                src={email.sender_photo}
                alt={email.sender}
                className={`w-10 h-10 rounded-full border ${email.sender_photo.includes('clearbit.com') ? 'bg-white p-1' : ''}`}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
                {email.sender.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{email.sender}</span>
                <span className="text-gray-500">&lt;{email.from.split('<')[1].split('>')[0]}&gt;</span>
              </div>
              <div className="text-xs text-gray-500 flex items-center space-x-2">
                <ClockIcon className="h-4 w-4" />
                <span>{formatDate(email.date)}</span>
              </div>
            </div>
          </div>
          <button className="text-blue-600 hover:text-blue-700 flex items-center space-x-1">
            <PaperAirplaneIcon className="h-5 w-5" />
            <span>Reply</span>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none ml-4"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-auto" style={{background:'#f5f5f5'}}>
          <div className="px-0 sm:px-6 py-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6 px-6">
              {email.subject}
            </h1>
            <div className="mb-4 space-y-1 text-sm text-gray-700">
              <div><span className="font-semibold">From:</span> {email.from}</div>
              <div><span className="font-semibold">To:</span> {email.to}</div>
              {email.cc && <div><span className="font-semibold">Cc:</span> {email.cc}</div>}
              {email.bcc && <div><span className="font-semibold">Bcc:</span> {email.bcc}</div>}
              <div><span className="font-semibold">Date:</span> {email.date}</div>
              <div><span className="font-semibold">Subject:</span> {email.subject}</div>
              {email.snippet && <div><span className="font-semibold">Snippet:</span> {email.snippet}</div>}
              {email.attachments && email.attachments.length > 0 && (
                <div className="mt-2">
                  <span className="font-semibold">Attachments:</span>
                  <ul className="list-disc ml-6">
                    {email.attachments.map((att, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <span>{att.filename}</span>
                        {/* Placeholder download link */}
                        <a
                          href="#"
                          className="text-blue-600 underline text-xs"
                          title="Download (not implemented)"
                          onClick={e => e.preventDefault()}
                        >
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <div style={gmailBodyStyles} className="prose max-w-none">
                {email.body_type === 'html'
                  ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(gmailHtml(email.body)) }} />
                  : linkifyWithImages(email.body)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailModal 