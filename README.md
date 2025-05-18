# Gmail Fetcher Template

## 🚀 How to Use This as a Template

1. **Clone or use as a GitHub template:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/gmail-template.git my-new-gmail-app
   cd my-new-gmail-app
   ```
2. **Install dependencies:**
   - Backend: `pip install -r requirements.txt`
   - Frontend: `npm install`
3. **Copy and edit `.env.example` to `.env`:**
   - Fill in your Google Cloud, Pub/Sub, and Flask settings.
4. **Set up Google Cloud:**
   - Create OAuth credentials, Pub/Sub topic, and service account as described below.
5. **Run tests to verify setup:**
   - Backend: `pytest`
   - Frontend: `npm test`
6. **Start developing!**
   - Backend: `python backend.py`
   - Frontend: `npm run dev`

---

A full-stack template for building Gmail-integrated web apps with React, Tailwind, Flask, and Google APIs.

## Features
- Google OAuth login and demo email/password login
- Fetch and display Gmail messages (with sender avatars, company logos, and attachments)
- Real-time updates via Gmail push notifications (Google Pub/Sub)
- Responsive, Gmail-like UI with React + Tailwind
- Local email persistence (localStorage)
- Easy to extend for custom email workflows

## Project Structure
```
/ (root)
├── backend.py           # Flask backend entry point
├── gmail_fetcher.py     # Gmail/People API logic, notification handling
├── .env                 # Environment variables (secrets, config)
├── requirements.txt     # Python dependencies
├── /src/                # React + Tailwind frontend
│   ├── App.jsx
│   ├── components/
│   │   ├── EmailModal.jsx
│   │   └── Login.jsx
│   └── ...
├── package.json         # Frontend dependencies
└── README.md            # This file
```

## Configuration
- All secrets and config are in `.env` (see example in repo).
- Update allowed CORS origins, ports, and Google settings as needed.

## Customization
- Extend `gmail_fetcher.py` for more Gmail/People API features.
- Tweak React components in `/src/` for your UI/UX needs.
- Add endpoints to `backend.py` for new workflows.

## Testing

### Backend (Python)
- Run all backend tests:
  ```bash
  pytest
  ```
- See coverage:
  ```bash
  coverage run -m pytest && coverage report
  ```

### Frontend (React)
- Run all frontend tests:
  ```bash
  npm test
  ```
- Add tests in `src/__tests__/` using [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

## License
MIT 