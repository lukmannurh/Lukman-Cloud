import sys
import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

widget = """  const progressWidget = downloadProgress.status !== 'idle' ? (
    <div className="fixed top-4 right-4 z-[9999] shadow-2xl rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-md p-4 w-80 animate-[slideInRight_0.3s_ease-out]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-white truncate pr-2" title={downloadProgress.fileName || 'file'}>
          {downloadProgress.status === 'success' ? 'Download Complete' :
           downloadProgress.status === 'error' ? 'Download Failed' : 
           `Downloading ${downloadProgress.fileName || 'file'}...`}
        </h3>
        <span className="text-xs font-mono text-blue-400 font-bold">
          {downloadProgress.status === 'success' ? '100%' : `${Math.round(downloadProgress.progress)}%`}
        </span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${downloadProgress.status === 'error' ? 'bg-red-500' : downloadProgress.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${downloadProgress.status === 'success' ? 100 : Math.round(downloadProgress.progress)}%` }}
        ></div>
      </div>
      {downloadProgress.errorMessage && (
        <p className="mt-2 text-xs text-red-400 break-words">{downloadProgress.errorMessage}</p>
      )}
    </div>
  ) : null;
"""

# Place the widget definition right before the first return
c = c.replace("  if (sessionLoading) {", widget + "\n  if (sessionLoading) {")

# 1. sessionLoading
c = c.replace(
    '  if (sessionLoading) {\n    return (\n      <div className="min-h-screen',
    '  if (sessionLoading) {\n    return (\n      <>\n        {progressWidget}\n        <div className="min-h-screen'
)
c = c.replace(
    '        </div>\n      </div>\n    );\n  }\n\n  if (showOnboarding',
    '        </div>\n      </div>\n      </>\n    );\n  }\n\n  if (showOnboarding'
)

# 2. showOnboarding
c = c.replace(
    '  if (showOnboarding && isUserAuthenticated) {\n    return (\n      <div className="min-h-screen',
    '  if (showOnboarding && isUserAuthenticated) {\n    return (\n      <>\n        {progressWidget}\n        <div className="min-h-screen'
)
c = c.replace(
    '              </form>\n            </div>\n          </div>\n        </div>\n      );\n    }',
    '              </form>\n            </div>\n          </div>\n        </div>\n      </>\n    );\n  }'
)

# 3. sharedNodeId
c = c.replace(
    '  if (sharedNodeId) {\n    return <AnonymousShareView sharedNodeId={sharedNodeId} />;\n  }',
    '  if (sharedNodeId) {\n    return (\n      <>\n        {progressWidget}\n        <AnonymousShareView sharedNodeId={sharedNodeId} setDownloadProgress={setDownloadProgress} />\n      </>\n    );\n  }'
)

# 4. !isUserAuthenticated
c = c.replace(
    '  if (!isUserAuthenticated) {\n    return <BetterAuthForm onDevBypass={(user) => {\n      if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === \'mock\') {\n        localStorage.setItem(\'dev_session_user\', JSON.stringify(user));\n        setDevSessionUser(user);\n      }\n    }} />;\n  }',
    '  if (!isUserAuthenticated) {\n    return (\n      <>\n        {progressWidget}\n        <BetterAuthForm onDevBypass={(user) => {\n          if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === \'mock\') {\n            localStorage.setItem(\'dev_session_user\', JSON.stringify(user));\n            setDevSessionUser(user);\n          }\n        }} />\n      </>\n    );\n  }'
)

# 5. Main return
c = c.replace(
    '  return (\n    <div className="flex flex-col min-h-dvh bg-slate-50 font-sans">',
    '  return (\n    <>\n      {progressWidget}\n      <div className="flex flex-col min-h-dvh bg-slate-50 font-sans">'
)

# Remove the old widget
c = re.sub(
    r'\s*{\/\* Floating Download Progress Widget \*\/}.*?<\/div>\n      \)}',
    '',
    c,
    flags=re.DOTALL
)

# End the final return
c = c.replace(
    '      )}\n    </div>\n  );\n}',
    '      )}\n    </div>\n    </>\n  );\n}'
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
