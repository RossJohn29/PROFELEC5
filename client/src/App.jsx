import { BrowserRouter, Routes, Route } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './Styles/App.css'
import './Styles/notifications.css'
import Signup from './Auth/Signup'
import Login from './Auth/Login'
import Dashboard from './Pages/DoctorSide/Ddashboard'
import DoctorLogs from './Pages/DoctorSide/DoctorLogs'
import ManageApp from './Pages/DoctorSide/ManageApp'
import PSettings from './Pages/Others/PSettings'
import DSettings from './Pages/Others/DSettings'
import About from './Pages/Others/About'
import PatientProfileForm from './Pages/PatientSide/PatientProfileForm'
import PDashboard from './Pages/PatientSide/PDashboard'
import PatientProfile from './Pages/PatientSide/PatientProfile'
import BookApp from './Pages/PatientSide/BookApp'
import DoctorLists from './Pages/PatientSide/DoctorLists'
import AppHistory from './Pages/PatientSide/AppHistory'
import DocProfile from './Pages/DoctorSide/DocProfile'
import DoctorSchedule from './Pages/DoctorSide/DoctorSchedule'
import Admin from './Pages/Admin/Admin'
import PatientAppDetails from './Pages/PatientSide/PatientAppDetails'
import DoctorAppDetails from './Pages/DoctorSide/DoctorAppDetails'
import AdminLog from './Auth/AdminLog'
import ForgotPassword from './Auth/ForgotPassword'
import ResetPassword from './Auth/ResetPassword'
import DoctorPatientDetails from './Pages/DoctorSide/DoctorPatientDetails'

function App() {

  return (
    <BrowserRouter>
      {/* Routes define which page is shown */}
      <Routes>
        <Route path='/' element={<About />} />
        <Route path='/register' element={<Signup />} />
        <Route path='/login' element={<Login />} />
        <Route path='/forgot-password' element={<ForgotPassword />} />
        <Route path='/reset-password' element={<ResetPassword />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/DoctorLogs' element={<DoctorLogs />} />
        <Route path='/Appointments' element={<ManageApp />} />
        <Route path='/PSettings' element={<PSettings />} />
        <Route path='/DSettings' element={<DSettings />} />
        <Route path='/About' element={<About />} />
        <Route path='/PatientForm' element={< PatientProfileForm />} />
        <Route path='/PatientDashboard' element={<PDashboard />} />
        <Route path='/DoctorLists' element={<DoctorLists />} />
        <Route path='/PatientProfile' element={<PatientProfile />} />
        <Route path='/BookApp/:email' element={<BookApp />} />
        <Route path='/PatientAppDetails' element={<PatientAppDetails />} />
        <Route path='/DoctorAppDetails' element={<DoctorAppDetails />} />
        <Route path='/AppHistory' element={<AppHistory />} />
        <Route path='/DoctorProfile' element={<DocProfile />} />
        <Route path='/DoctorSchedule' element={<DoctorSchedule />} />
        <Route path='/Admin' element={<Admin />} />
        <Route path='/AdminLog' element={<AdminLog />} />
        <Route path='/Doctor/Patient/:email' element={<DoctorPatientDetails />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
