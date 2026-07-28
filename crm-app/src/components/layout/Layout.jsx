import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-charcoal-950 flex font-sans text-gray-300">
            <Sidebar
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />

            <div
                className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300
          ${sidebarOpen ? 'ml-20 w-[calc(100vw-5rem)] lg:ml-64 lg:w-[calc(100vw-16rem)]' : 'ml-20 w-[calc(100vw-5rem)]'}
        `}
            >
                <Header />

                <main className="flex-1 p-4 md:p-6 overflow-x-hidden overflow-y-auto w-full max-w-[1600px] mx-auto">
                    <ErrorBoundary key={location.pathname}>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    );
}
