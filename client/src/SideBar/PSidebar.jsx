//Sidebar Patient
import * as FaIcons from 'react-icons/fa'
import * as AiIcons from 'react-icons/ai'

export const PSidebar = [

    {
        title: 'Home',
        path: '/PatientDashboard',
        icon: <AiIcons.AiFillHome />,
        cName: 'nav-text'
    },
    {
        title: 'Book',
        path: '/DoctorLists',
        icon: <FaIcons.FaBookmark />,
        cName: 'nav-text'
    },
    {
        title: 'History',
        path: '/AppHistory',
        icon: <AiIcons.AiOutlineHistory />,
        cName: 'nav-text'
    },
    
]
