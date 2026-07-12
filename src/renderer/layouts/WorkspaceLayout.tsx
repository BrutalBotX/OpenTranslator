import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Users, BookMarked, MessageSquare, Settings, FolderOpen, ChevronRight } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'
import { useStatusStore } from '../stores/statusStore'
import StatusBar from '../components/StatusBar'
import LoadingOverlay from '../components/LoadingOverlay'

const LANG_NAMES: Record<string, string> = {
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  en: 'English', fr: 'French', de: 'German', es: 'Spanish',
}

function langName(code: string): string {
  return LANG_NAMES[code] || code.toUpperCase()
}

export default function WorkspaceLayout() {
  const novel = useProjectStore(s => s.novel)
  const location = useLocation()

  const novelId = novel?.id
  const translatePath = novelId ? `/translate/${novelId}` : null

  const navItems = [
    { to: '/', icon: FolderOpen, label: 'Projects' },
    ...(translatePath ? [
      { to: translatePath, icon: BookOpen, label: 'Chapters' },
      { to: `/characters/${novelId}`, icon: Users, label: 'Characters' },
      { to: `/glossary/${novelId}`, icon: BookMarked, label: 'Glossary' },
      { to: `/qa/${novelId}`, icon: MessageSquare, label: 'QA Queue' },
    ] : []),
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <LoadingOverlay />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-800">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-cyan-400 truncate">{novel?.title || 'OpenTranslator'}</h1>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {novel ? `${langName(novel.source_lang)} → ${langName(novel.target_lang)}` : 'AI Webnovel Translator'}
              </p>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/' || (translatePath ? item.to === translatePath : false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-cyan-600/20 text-cyan-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                <ChevronRight size={14} className="ml-auto opacity-50" />
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
