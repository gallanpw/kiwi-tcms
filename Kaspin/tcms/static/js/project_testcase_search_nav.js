(function () {
    const projectTree = document.getElementById('suite-tree')
    if (projectTree?.dataset.projectCode) {
        window.localStorage.setItem('activeTestProjectCode', projectTree.dataset.projectCode)
    }

    function showProjectToast () {
        let toast = document.getElementById('project-selection-toast')
        if (!toast) {
            toast = document.createElement('div')
            toast.id = 'project-selection-toast'
            toast.setAttribute('role', 'alert')
            toast.textContent = 'Mohon pilih project dahulu!'
            Object.assign(toast.style, {
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: '10000',
                background: '#a94442',
                color: '#fff',
                padding: '12px 20px',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,.25)'
            })
            document.body.append(toast)
        }
        toast.hidden = false
        window.setTimeout(() => { toast.hidden = true }, 3000)
    }

    const routes = [
        { label: /search\s+test\s+cases/i, path: /^\/cases\/search\/$/, to: code => `/project/${encodeURIComponent(code)}/testcases/` },
        { label: /search\s+test\s+plans/i, path: /^\/plan\/search\/$/, to: code => `/plan/${encodeURIComponent(code)}/search/` },
        { label: /search\s+test\s+runs/i, path: /^\/runs\/search\/$/, to: code => `/runs/${encodeURIComponent(code)}/project/search/` },
        { label: /search\s+bugs/i, path: /^\/bugs\/search\/$/, to: code => `/bugs/${encodeURIComponent(code)}/search/` },
        { label: /new\s+test\s+plan/i, path: /^\/plan\/new\/$/, to: code => `/plan/${encodeURIComponent(code)}/new/` },
        { label: /new\s+test\s+case/i, path: /^\/cases\/new\/$/, to: code => `/cases/${encodeURIComponent(code)}/new/` },
        { label: /new\s+test\s+run/i, path: /^\/runs\/new\/$/, to: code => `/runs/${encodeURIComponent(code)}/new/` },
        { label: /new\s+bug/i, path: /^\/bugs\/new\/$/, to: code => `/bugs/${encodeURIComponent(code)}/new/` },
        { label: /search\s+test\s+executions/i, path: /^\/telemetry\/testing\/execution\/dashboard\/$/, to: code => `/telemetry/${encodeURIComponent(code)}/testing/execution/dashboard/` },
        { path: /^\/telemetry\/testing\/execution\/dashboard\/$/, to: code => `/telemetry/${encodeURIComponent(code)}/testing/execution/dashboard/` },
        { label: /^breakdown$/i, path: /^\/telemetry\/testing\/breakdown\/$/, to: code => `/telemetry/${encodeURIComponent(code)}/testing/breakdown/` },
        { label: /^testcase\s+health$/i, path: /^\/telemetry\/testing\/test-case-health\/$/, to: code => `/telemetry/${encodeURIComponent(code)}/testing/test-case-health/` }
    ]

    document.addEventListener('click', event => {
        const link = event.target.closest('a')
        if (!link) return

        const match = routes.find(route =>
            route.label?.test(link.textContent.trim()) || route.path.test(link.pathname)
        )
        if (!match) return

        const projectCode = window.localStorage.getItem('activeTestProjectCode')
        event.preventDefault()
        if (!projectCode) {
            showProjectToast()
            return
        }

        const destination = new URL(match.to(projectCode), window.location.origin)
        destination.search = link.search
        destination.hash = link.hash
        window.location.assign(destination.href)
    })
}())
