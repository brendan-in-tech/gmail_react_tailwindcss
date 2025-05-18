import React, { useState, useEffect } from 'react'
import { EnvelopeIcon, PaperAirplaneIcon, CalendarIcon, StarIcon } from '@heroicons/react/24/outline'
import EmailModal from './components/EmailModal'
import Login from './components/Login'

function App() {
  const [emails, setEmails] = useState(() => {
    // Initialize from localStorage if available
    const savedEmails = localStorage.getItem('emails')
    return savedEmails ? JSON.parse(savedEmails) : []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [serverStatus, setServerStatus] = useState('checking')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState(Date.now())

  // Save emails to localStorage whenever they change
  useEffect(() => {
    if (emails.length > 0) {
      localStorage.setItem('emails', JSON.stringify(emails))
    }
  }, [emails])

  // Poll for new emails every 30 seconds
  useEffect(() => {
    if (!user) return

    const checkNewEmails = async () => {
      try {
        const response = await fetch('http://localhost:5001/check-new-emails', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        if (data.has_new && data.new_emails) {
          // Add new emails to the beginning of the list
          setEmails(prevEmails => {
            const newEmails = data.new_emails
            const existingIds = new Set(prevEmails.map(email => email.id))
            const uniqueNewEmails = newEmails.filter(email => !existingIds.has(email.id))
            return [...uniqueNewEmails, ...prevEmails]
          })
        }
        setLastCheck(Date.now())
      } catch (err) {
        console.error('Error checking for new emails:', err)
      }
    }

    const interval = setInterval(checkNewEmails, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [user])

  // Clear emails from localStorage on logout
  const handleLogout = async () => {
    await fetch('http://localhost:5001/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
    setEmails([])
    setSelectedEmail(null)
    localStorage.removeItem('emails')
  }

  // Format date for email list
  const formatDate = (date) => {
    if (!date) return ''
    const now = new Date()
    const emailDate = new Date(date)
    const diffDays = Math.floor((now - emailDate) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return emailDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return emailDate.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return emailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  useEffect(() => {
    // Check if server is running
    fetch('http://localhost:5001/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setServerStatus('running')
      })
      .catch(err => {
        console.error('Server check error:', err)
        setServerStatus('error')
        setError('Server is not running. Please start the Flask server.')
      })
  }, [])

  useEffect(() => {
    // Check authentication
    fetch('http://localhost:5001/me', {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
          // If we have a user but no emails, fetch them
          if (emails.length === 0) {
            fetchEmails()
          }
        }
        setAuthLoading(false)
      })
      .catch(() => setAuthLoading(false))
  }, [])

  const handleLogin = (user) => {
    setUser(user)
    setError(null)
    // If we have a user but no emails, fetch them
    if (emails.length === 0) {
      fetchEmails()
    }
  }

  const fetchEmails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:5001/fetch-emails', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setEmails(data)
    } catch (err) {
      console.error('Error fetching emails:', err)
      if (err.message.includes('Failed to fetch')) {
        setError('Unable to connect to the server. Please make sure the backend is running on port 5001.')
      } else {
        setError(err.message || 'Failed to fetch emails. Please try again.')
      }
    }
    setLoading(false)
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-gray-600">Loading...</div>
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="px-8 py-6 sm:px-12">
          {/* Header Section */}
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 bg-white" style={{minHeight: '72px'}}>
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-1">Inbox</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Server Status: {serverStatus === 'checking' ? 'Checking...' : 
                              serverStatus === 'running' ? 'Running' : 'Not Running'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {user.photo ? (
                <img
                  src={user.photo}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold border">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={fetchEmails}
                disabled={loading || serverStatus !== 'running'}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                style={{height: '40px'}}
              >
                {loading ? 'Loading...' : 'Refresh Emails'}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Logout
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {emails.map((email, index) => (
                <li 
                  key={index}
                  onClick={() => setSelectedEmail(email)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="px-4 py-3 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className="flex-shrink-0 mr-3">
                          {email.sender_photo ? (
                            <img
                              src={email.sender_photo}
                              alt={email.sender}
                              className={`w-8 h-8 rounded-full border ${email.sender_photo.includes('clearbit.com') ? 'bg-white p-1' : ''}`}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold border">
                              {email.sender.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {email.sender}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {formatDate(email.date)}
                              </span>
                              <button className="text-gray-400 hover:text-yellow-400">
                                <StarIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {email.subject}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {email.snippet}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {emails.length === 0 && !loading && serverStatus === 'running' && (
                <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                  No emails to display. Click "Refresh Emails" to fetch your inbox.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <EmailModal 
        email={selectedEmail} 
        onClose={() => setSelectedEmail(null)} 
      />
    </div>
  )
}

export default App 