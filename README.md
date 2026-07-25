# MedPath AI - Medical Journey Navigator

A comprehensive healthcare management platform that guides patients through symptom assessment, appointment preparation, medication management, and provider search. Built with modern web technologies and powered by AI-assisted health insights.

## 🌟 Features

### Core Functionality
- **Symptom Checker**: Multi-step AI-powered symptom triage with urgency assessment
- **Appointment Preparation**: Personalized checklists for medical visits
- **Medication Manager**: Drug interaction checking and management
- **Provider Search**: Location-based healthcare provider discovery
- **Health Timeline**: Visual tracking of symptoms, temperature, and heart rate trends
- **AI Health Education**: Explanations of medical conditions and terminology
- **Patient Profile Management**: Comprehensive medical profile with allergies and conditions

### Authentication & Security
- Secure user registration and login with JWT tokens
- Password hashing with bcrypt (12 rounds)
- Soft-delete pattern for data retention
- Login history tracking with IP and user-agent logging
- Account deletion with password verification

### User Experience
- Multi-language support (6 languages: English, Spanish, French, Hindi, Gujarati, Chinese)
- Responsive React UI with modern design system
- Real-time data persistence
- Role-based access control

## 🛠️ Tech Stack

### Frontend
- **React 19+** with Vite bundler
- **Recharts** for data visualization
- **Lucide React** for icons
- **Axios** for API calls
- **CSS-in-JS** with design tokens

### Backend
- **Node.js 22.19.0** with Express.js
- **PostgreSQL 18** with pgcrypto extension
- **JWT** for authentication
- **Bcrypt** for password security
- **Multer** for file uploads
- **Zod** for input validation

### AI/ML Service
- **Python 3.8+**
- **FastAPI** for AI service API
- **Uvicorn** ASGI server
- **RAG (Retrieval-Augmented Generation)** for knowledge base
- **OCR** capabilities for document processing

### Database
- **PostgreSQL 18** with pgcrypto extension
- JSONB fields for flexible data storage
- UUID primary keys
- Timezone-aware timestamps (TIMESTAMPTZ)
- 20+ optimized tables with composite indexes

### DevOps & Deployment
- **Docker** & **Docker Compose** for containerization
- **Dockerfile** for both Node.js API and Python AI service
- Environment-based configuration (.env)
- Multi-container orchestration

### Development Tools
- **npm/yarn** for package management
- **Vite** dev server with HMR (Hot Module Replacement)
- **Nodemon** for auto-restart on file changes
- **Git** for version control
- **Postman/cURL** for API testing

## 📋 Prerequisites

- Node.js 22.19.0+
- PostgreSQL 18+
- npm or yarn
- Python 3.8+ (for AI service, optional)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/prushti1521/MedPath-AI.git
cd MedPath-AI
```

### 2. Database Setup
```bash
# Create database
createdb medpath_ai

# Connection string (update with your password)
postgresql://postgres:YOUR_PASSWORD@localhost:5432/medpath_ai
```

### 3. Backend Setup
```bash
cd backend-scaffold/backend/node-api

# Install dependencies
npm install

# Configure environment
# Create or update .env file with:
DATABASE_URL=postgresql://postgres:Pari%40%23%241521@localhost:5432/medpath_ai
JWT_SECRET=your-secret-key-here
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://localhost:5178,http://localhost:5179

# Initialize database schema
npm run db:init  # or manually run schema.sql

# Start backend
npm start
```

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 📂 Project Structure

```
MedPath-AI/
├── backend-scaffold/
│   └── backend/
│       ├── node-api/                 # Express.js API server
│       │   ├── src/
│       │   │   ├── index.js          # Server entry point
│       │   │   ├── db/
│       │   │   │   ├── pool.js       # PostgreSQL connection pool
│       │   │   │   └── schema.sql    # Database schema
│       │   │   └── routes/           # API endpoints
│       │   │       ├── auth.routes.js
│       │   │       ├── profile.routes.js
│       │   │       ├── medications.routes.js
│       │   │       ├── appointments.routes.js
│       │   │       └── ...
│       │   └── Dockerfile
│       └── ai-service/               # Python AI service (optional)
│           ├── main.py
│           ├── triage.py
│           ├── rag.py
│           └── requirements.txt
├── frontend/                         # React 19+ application
│   ├── src/
│   │   ├── App.jsx                  # Main app with routing
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── Dashboard.jsx
│   │       └── ...
│   └── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `DELETE /auth/account` - Account deletion

### Profile
- `GET /profile` - Get user profile
- `PATCH /profile` - Update profile
- `POST /profile/photo` - Upload profile photo

### Medications
- `GET /medications` - Get user medications
- `POST /medications` - Add medication
- `DELETE /medications/:id` - Remove medication

### Symptoms
- `POST /symptoms/check` - Symptom triage assessment
- `GET /symptoms/timeline` - Get symptom history

### Appointments
- `GET /appointments` - Get user appointments
- `POST /appointments` - Create appointment
- `GET /appointments/prep` - Get appointment prep checklist

### Providers
- `GET /providers/search` - Search healthcare providers
- `GET /providers/nearby` - Find nearby providers

## 🗄️ Database Schema Highlights

### Core Tables
- **users** - User accounts with soft-delete
- **login_history** - Login/logout audit trail
- **medical_profiles** - Patient demographic and health info
- **allergies** - Documented allergies
- **chronic_conditions** - Ongoing health conditions
- **medications** - Current medications
- **symptom_sessions** - Symptom assessment sessions
- **symptom_timeline_entries** - Individual symptom entries over time
- **appointments** - Medical appointments
- **healthcare_providers** - Provider directory

### Features
- UUID primary keys
- JSONB fields for flexible data
- Timezone-aware timestamps
- Composite indexes for performance
- Soft-delete pattern with `is_deleted` flag

## 🔐 Security Features

- JWT bearer token authentication
- Password hashing with bcrypt (12 rounds)
- CORS configured for dev ports
- Input validation with Zod
- SQL injection prevention via parameterized queries
- Soft-delete for data retention compliance
- Login history tracking for audit trails

## 👤 Test Credentials

```
Email: testuser@example.com
Password: TestPass123!
```

## 🧪 Testing

All features have been tested and validated:
- ✅ Complete authentication lifecycle (register → login → logout)
- ✅ Profile creation and updates
- ✅ Symptom checker with triage assessment
- ✅ Appointment preparation workflow
- ✅ Medication management with interaction checking
- ✅ Provider search functionality
- ✅ Timeline visualization with health trends
- ✅ Multi-language support
- ✅ Account deletion with soft-delete

## 📊 Dashboard Features Tested

1. **Today's Health Status** - Real-time health status display
2. **Upcoming Appointments** - Appointment scheduler
3. **Medication Reminder** - Active medication tracking
4. **Recent Symptoms** - Latest symptom logs
5. **Health Score** - Overall health assessment
6. **Risk Alerts** - Health risk notifications
7. **AI Suggestions** - Personalized health insights
8. **Recent Reports** - Medical document management

## 🌐 Multi-Language Support

Supported languages:
- English
- Español (Spanish)
- Français (French)
- हिन्दी (Hindi)
- ગુજરાતી (Gujarati)
- 中文 (Chinese)

## 🚢 Deployment

### Docker Deployment
```bash
cd backend-scaffold/backend/node-api
docker build -t medpath-api .
docker run -p 4000:4000 medpath-api
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:password@host:5432/medpath_ai
JWT_SECRET=your-production-secret
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

## 📝 API Documentation

Full API documentation is available in each route file:
- Authentication: `backend-scaffold/backend/node-api/src/routes/auth.routes.js`
- Profile: `backend-scaffold/backend/node-api/src/routes/profile.routes.js`
- Medications: `backend-scaffold/backend/node-api/src/routes/medications.routes.js`

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Verify PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check database exists
psql -U postgres -c "\l"

# Verify connection string in .env
```

### CORS Errors
- Ensure `CORS_ORIGIN` in backend `.env` includes frontend port
- Restart backend after changing CORS settings

### Port Already in Use
```bash
# Find and kill process on port
lsof -i :4000  # Check backend
lsof -i :5173  # Check frontend
kill -9 <PID>
```

## 📈 Future Enhancements

- [ ] Wearable device integration (Apple Health, Google Fit, Fitbit)
- [ ] Telemedicine consultation scheduling
- [ ] Electronic health records (EHR) integration
- [ ] Advanced analytics dashboard
- [ ] Mobile application
- [ ] Voice-based symptom input
- [ ] AI-powered treatment recommendations

## 📄 License

This project is open source and available under the MIT License.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, please open an issue on the GitHub repository or contact the development team.

---

**GitHub**: https://github.com/prushti1521/MedPath-AI

**Version**: 1.0.0

**Last Updated**: July 2026
