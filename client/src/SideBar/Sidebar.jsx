//Sidebar Doctor

import * as FaIcons from "react-icons/fa"
import * as AiIcons from "react-icons/ai"
import * as MdIcons from "react-icons/md"



export const SidebarData = [
    {
        title: 'Home',
        path: '/dashboard',
        icon: <AiIcons.AiFillHome />,
        cName: 'nav-text'
    },

    {
        title: 'Logs',
        path: '/DoctorLogs',
        icon: <FaIcons.FaBook />,
        cName: 'nav-text'
    },

    {
        title: 'Manage',
        path: '/Appointments',
        icon: <FaIcons.FaCalendarPlus />,
        cName: 'nav-text'
    },

    {
        title: 'Schedule',
        path: '/DoctorSchedule',
        icon: <MdIcons.MdSchedule />,
        cName: 'nav-text'
    },

    


]

