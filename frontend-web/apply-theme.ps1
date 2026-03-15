$basePath = "C:\Users\tohgl\Music\T-Cardio\T-Card\frontend-web\app\(dashboard)"

$files = @(
  "measurements\add\page.tsx",
  "analytics\page.tsx",
  "ai-analysis\page.tsx",
  "my-doctor\page.tsx",
  "teleconsultations\page.tsx",
  "teleconsultations\[id]\page.tsx",
  "reports\page.tsx",
  "abonnement\page.tsx",
  "credits\page.tsx",
  "notifications\page.tsx",
  "profile\page.tsx",
  "doctor\dashboard\page.tsx",
  "doctor\patients\page.tsx",
  "doctor\patients\[id]\page.tsx",
  "doctor\agenda\page.tsx",
  "doctor\teleconsultations\page.tsx",
  "doctor\reports\page.tsx",
  "admin\dashboard\page.tsx",
  "admin\users\page.tsx",
  "admin\doctors\page.tsx",
  "admin\communication\page.tsx",
  "admin\publicites\page.tsx",
  "admin\ai-config\page.tsx",
  "admin\payments\page.tsx",
  "admin\audit\page.tsx"
)

foreach ($f in $files) {
  $path = Join-Path $basePath $f
  if (Test-Path $path) {
    $content = [System.IO.File]::ReadAllText($path)

    # Risk/Status badges - specific patterns first
    $content = $content.Replace('bg-green-100 text-green-800', 'bg-green-500/15 text-green-400')
    $content = $content.Replace('bg-green-100 text-green-700', 'bg-green-500/15 text-green-400')
    $content = $content.Replace('bg-green-50 text-green-700', 'bg-green-500/10 text-green-400')
    $content = $content.Replace('bg-yellow-100 text-yellow-800', 'bg-amber-500/15 text-amber-400')
    $content = $content.Replace('bg-yellow-100 text-yellow-700', 'bg-amber-500/15 text-amber-400')
    $content = $content.Replace('bg-yellow-50 text-yellow-800', 'bg-amber-500/10 text-amber-400')
    $content = $content.Replace('bg-yellow-50 text-yellow-700', 'bg-amber-500/10 text-amber-400')
    $content = $content.Replace('bg-red-100 text-red-800', 'bg-red-500/15 text-red-400')
    $content = $content.Replace('bg-red-100 text-red-700', 'bg-red-500/15 text-red-400')
    $content = $content.Replace('bg-red-100 text-red-600', 'bg-red-500/15 text-red-400')
    $content = $content.Replace('bg-red-50 text-red-700', 'bg-red-500/10 text-red-400')
    $content = $content.Replace('bg-red-50 text-red-600', 'bg-red-500/10 text-red-400')
    $content = $content.Replace('bg-red-200 text-red-900', 'bg-red-500/20 text-red-300')
    $content = $content.Replace('bg-red-200 text-red-800', 'bg-red-500/20 text-red-300')
    $content = $content.Replace('bg-red-200 text-red-700', 'bg-red-500/20 text-red-300')
    $content = $content.Replace('bg-blue-100 text-blue-800', 'bg-cyan-500/15 text-cyan-400')
    $content = $content.Replace('bg-blue-100 text-blue-700', 'bg-cyan-500/15 text-cyan-400')

    # Alert banners
    $content = $content.Replace('bg-red-50 border-red-200', 'bg-red-500/10 border-red-500/20')
    $content = $content.Replace('bg-red-50 border-red-300', 'bg-red-500/10 border-red-500/20')
    $content = $content.Replace('bg-green-50 border-green-200', 'bg-green-500/10 border-green-500/20')
    $content = $content.Replace('bg-green-50 border-green-300', 'bg-green-500/10 border-green-500/20')
    $content = $content.Replace('bg-amber-50 border-amber-200', 'bg-amber-500/10 border-amber-500/20')
    $content = $content.Replace('bg-orange-50 border-orange-300', 'bg-orange-500/10 border-orange-500/20')
    $content = $content.Replace('bg-yellow-50 border-yellow-300', 'bg-amber-500/10 border-amber-500/20')

    # More colored badges
    $content = $content.Replace('bg-gray-100 text-gray-600', 'bg-cardio-800 text-slate-400')
    $content = $content.Replace('bg-gray-100 text-gray-500', 'bg-cardio-800 text-slate-400')
    $content = $content.Replace('bg-gray-100 text-gray-700', 'bg-cardio-800 text-slate-300')
    $content = $content.Replace('bg-teal-100 text-teal-700', 'bg-teal-500/15 text-teal-400')
    $content = $content.Replace('bg-indigo-100 text-indigo-700', 'bg-indigo-500/15 text-indigo-400')
    $content = $content.Replace('bg-purple-100 text-purple-700', 'bg-purple-500/15 text-purple-400')
    $content = $content.Replace('bg-orange-100 text-orange-700', 'bg-orange-500/15 text-orange-400')

    # Borders - before bg changes
    $content = $content.Replace('border-gray-200', 'border-cyan-500/10')
    $content = $content.Replace('border-gray-100', 'border-cyan-500/10')
    $content = $content.Replace('border-gray-300', 'border-cyan-500/15')
    $content = $content.Replace('border-blue-200', 'border-cyan-500/20')
    $content = $content.Replace('border-blue-100', 'border-cyan-500/20')
    $content = $content.Replace('border-blue-500', 'border-cyan-500')
    $content = $content.Replace('border-blue-300', 'border-cyan-500/20')
    $content = $content.Replace('divide-gray-200', 'divide-cyan-500/10')
    $content = $content.Replace('divide-gray-100', 'divide-cyan-500/10')
    $content = $content.Replace('divide-gray-50', 'divide-cyan-500/10')

    # Table header bg
    $content = $content.Replace('className="bg-gray-50"', 'className="bg-cardio-800"')
    $content = $content.Replace('bg-gray-50 border-b', 'bg-cardio-800 border-b')

    # Text colors
    $content = $content.Replace('text-gray-900', 'text-slate-100')
    $content = $content.Replace('text-gray-800', 'text-slate-200')
    $content = $content.Replace('text-gray-700', 'text-slate-300')
    $content = $content.Replace('text-gray-600', 'text-slate-400')
    $content = $content.Replace('text-gray-500', 'text-slate-400')
    $content = $content.Replace('text-gray-400', 'text-slate-500')
    $content = $content.Replace('text-gray-300', 'text-slate-600')
    $content = $content.Replace('text-blue-800', 'text-cyan-300')
    $content = $content.Replace('text-blue-700', 'text-cyan-400')
    $content = $content.Replace('text-blue-600', 'text-cyan-400')
    $content = $content.Replace('text-blue-500', 'text-cyan-400')

    # Backgrounds
    $content = $content.Replace('bg-blue-50', 'bg-cyan-500/10')
    $content = $content.Replace('bg-blue-100', 'bg-cyan-500/15')
    $content = $content.Replace('bg-red-50', 'bg-red-500/10')
    $content = $content.Replace('bg-gray-50', 'bg-cardio-800/50')
    $content = $content.Replace('bg-gray-100', 'bg-cardio-800')

    # Hover states
    $content = $content.Replace('hover:bg-gray-50', 'hover:bg-cardio-700/30')
    $content = $content.Replace('hover:bg-gray-100', 'hover:bg-cardio-700/50')
    $content = $content.Replace('hover:bg-gray-200', 'hover:bg-cardio-700/50')
    $content = $content.Replace('hover:bg-blue-50', 'hover:bg-cyan-500/10')
    $content = $content.Replace('hover:bg-blue-100', 'hover:bg-cyan-500/15')
    $content = $content.Replace('hover:bg-blue-700', 'hover:bg-teal-700')
    $content = $content.Replace('active:bg-gray-50', 'active:bg-cardio-700/30')
    $content = $content.Replace('active:bg-cardio-800/50', 'active:bg-cardio-700/30')

    # Focus rings
    $content = $content.Replace('focus:ring-blue-500', 'focus:ring-cyan-500')
    $content = $content.Replace('focus:border-blue-500', 'focus:border-cyan-500')
    $content = $content.Replace('ring-blue-500', 'ring-cyan-500')

    # Spinner borders
    $content = $content.Replace('border-b-2 border-blue-600', 'border-b-2 border-cyan-400')
    $content = $content.Replace('border-blue-200 border-t-blue-600', 'border-cyan-800 border-t-cyan-400')
    $content = $content.Replace('border-blue-600', 'border-cyan-400')
    $content = $content.Replace('border-t-transparent', 'border-t-transparent')

    # glow-btn for blue buttons
    $content = $content.Replace('bg-blue-600 text-white', 'glow-btn')
    $content = $content.Replace('bg-blue-500 text-white', 'glow-btn')

    # Link hover
    $content = $content.Replace('hover:text-blue-800', 'hover:text-cyan-300')
    $content = $content.Replace('hover:text-blue-700', 'hover:text-cyan-300')

    # bg-white cards -> glass-card
    $content = $content.Replace('bg-white rounded-xl shadow overflow-hidden', 'glass-card rounded-xl overflow-hidden')
    $content = $content.Replace('bg-white rounded-xl shadow overflow-x-auto', 'glass-card rounded-xl overflow-x-auto')
    $content = $content.Replace('bg-white rounded-xl shadow', 'glass-card rounded-xl')
    $content = $content.Replace('bg-white rounded-2xl shadow', 'glass-card rounded-2xl')
    $content = $content.Replace('bg-white p-12 rounded-xl shadow text-center', 'glass-card p-12 rounded-xl text-center')
    $content = $content.Replace('bg-white p-6 rounded-xl shadow', 'glass-card p-6 rounded-xl')
    $content = $content.Replace('bg-white p-4 rounded-xl shadow', 'glass-card p-4 rounded-xl')
    $content = $content.Replace('bg-white p-3 rounded-xl shadow', 'glass-card p-3 rounded-xl')
    $content = $content.Replace('bg-white p-5 rounded-xl shadow', 'glass-card p-5 rounded-xl')
    $content = $content.Replace('bg-white border border-cyan-500/10 rounded-xl', 'glass-card border border-cyan-500/10 rounded-xl')
    $content = $content.Replace('bg-white border rounded-xl', 'glass-card border border-cyan-500/10 rounded-xl')
    $content = $content.Replace('bg-white rounded-2xl border-2', 'glass-card rounded-2xl border-2')
    $content = $content.Replace('bg-white', 'glass-card')

    # Remove shadow from glass-card elements
    $content = $content.Replace('glass-card rounded-xl shadow-sm', 'glass-card rounded-xl')
    $content = $content.Replace('shadow-amber-100', '')
    $content = $content.Replace('hover:shadow-lg', '')
    $content = $content.Replace('shadow-lg', '')
    $content = $content.Replace('shadow-md', '')
    $content = $content.Replace('shadow-sm', '')
    $content = $content.Replace(' shadow ', ' ')

    # Gradient replacements
    $content = $content.Replace('bg-gradient-to-r from-blue-600 to-indigo-600', 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700')
    $content = $content.Replace('bg-gradient-to-br from-blue-600 to-indigo-700', 'bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700')
    $content = $content.Replace('bg-gradient-to-r from-cyan-500/10 to-indigo-500/10', 'glass-card')
    $content = $content.Replace('text-blue-200', 'text-cyan-200')

    # Colored bg for stat cards
    $content = $content.Replace('bg-green-50', 'bg-green-500/10')
    $content = $content.Replace('bg-purple-50', 'bg-purple-500/10')
    $content = $content.Replace('bg-indigo-50', 'bg-indigo-500/10')
    $content = $content.Replace('bg-teal-50', 'bg-teal-500/10')
    $content = $content.Replace('bg-orange-50', 'bg-orange-500/10')
    $content = $content.Replace('bg-yellow-50', 'bg-amber-500/10')

    # Fix double glass-card
    $content = $content.Replace('glass-card glass-card', 'glass-card')

    # Clean double spaces
    $content = $content.Replace('  ', ' ')

    # Remove leftover hover:bg-teal-700 that came from glow-btn replacements
    # (glow-btn already handles hover)

    [System.IO.File]::WriteAllText($path, $content)
    Write-Output "Updated: $f"
  } else {
    Write-Output "NOT FOUND: $f"
  }
}
Write-Output "DONE - All files processed"
