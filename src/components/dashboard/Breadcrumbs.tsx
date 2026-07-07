export interface BreadcrumbItem {
  id: string;
  name: string;
}

export function Breadcrumbs({
  path,
  onNavigate
}: {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pl-1">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 && (
            <svg className="w-4 h-4 text-slate-400 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <button
            onClick={() => onNavigate(item.id)}
            className={`text-lg transition-colors px-2 py-1 rounded-md ${
              index === path.length - 1 ? 'text-slate-800 font-semibold' : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  );
}
