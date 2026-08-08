import { getInitials } from '@/lib/utils';
import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export default function Header({ title, userName = 'Usuario', userEmail, userRole }: HeaderProps) {
  void userEmail; // Reserved for future tooltip
  return (
    <header className="h-14 2xl:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 2xl:px-6">
      <div className="min-w-0">
        <h1 className="text-lg 2xl:text-xl font-semibold text-gray-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 2xl:gap-4 shrink-0">
        {/* Search: only on very large screens, hidden in notebook widths to save space */}
        <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 2xl:py-2 bg-gray-100 rounded-lg">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none outline-none text-sm text-gray-700 w-48"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2 2xl:gap-3">
          <div className="w-8 h-8 2xl:w-9 2xl:h-9 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {getInitials(userName)}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[9rem] 2xl:max-w-none">{userName}</p>
            {userRole && (
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
