(function () {
  const list = document.getElementById('projects-list');
  const table = document.getElementById('projects-table');
  const form = document.getElementById('project-form');
  const modal = document.getElementById('project-modal');
  const error = document.getElementById('project-error');
  const modalError = document.getElementById('project-modal-error');
  const empty = document.getElementById('projects-empty');
  const noResults = document.getElementById('projects-no-results');
  const count = document.getElementById('project-count');
  const search = document.getElementById('project-search');
  const csrf = document.querySelector('[name=csrfmiddlewaretoken]').value;
  const nameInput = document.getElementById('project-name');
  const codeInput = document.getElementById('project-code');
  const logoInput = document.getElementById('project-logo');
  window.localStorage.removeItem('activeTestProjectCode');
  let modalBackdrop;
  let lastFocusedElement;

  const request = (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      ...(options.headers || {}),
    },
  });
  async function responseData(response) {
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    let data;
    if (contentType.includes('application/json')) {
      try { data = body ? JSON.parse(body) : {}; }
      catch (_) { throw new Error(`Respons API tidak valid (HTTP ${response.status}).`); }
    } else {
      const document = new DOMParser().parseFromString(body, 'text/html');
      const detail = document.querySelector('h1, h2, title')?.textContent?.trim();
      throw new Error(`Server mengembalikan halaman non-JSON (HTTP ${response.status})${detail ? `: ${detail}` : ''}.`);
    }
    if (!response.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
    return data;
  }
  function showModal() {
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('in');
    document.body.classList.add('modal-open');
    modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop fade in';
    modalBackdrop.addEventListener('click', hideModal);
    document.body.append(modalBackdrop);
    nameInput.focus();
  }
  function hideModal() {
    modal.classList.remove('in');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalBackdrop?.remove();
    modalBackdrop = null;
    lastFocusedElement?.focus();
  }

  let projects = [];
  function projectDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${part('day')} ${part('month')}, ${part('year')}`;
  }
  function projectInitials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
  function makeAction(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener('click', handler);
    return button;
  }
  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = projects.filter((project) =>
      `${project.name} ${project.code}`.toLocaleLowerCase().includes(query),
    );
    count.textContent = `${visible.length} of ${projects.length} projects`;
    empty.hidden = projects.length !== 0;
    noResults.hidden = projects.length === 0 || visible.length !== 0;
    table.hidden = visible.length === 0;
    list.replaceChildren();

    visible.forEach((project) => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.className = 'project-name-cell';
      const title = document.createElement('a');
      title.className = 'project-name-link';
      title.href = `/project/${encodeURIComponent(project.code)}/testcases/`;
      title.textContent = project.name;

      if (project.logo) {
        const image = document.createElement('img');
        image.src = project.logo;
        image.alt = '';
        image.className = 'project-logo';
        nameCell.append(image);
      } else {
        const monogram = document.createElement('span');
        monogram.className = 'project-monogram';
        monogram.setAttribute('aria-hidden', 'true');
        monogram.textContent = projectInitials(project.name);
        nameCell.append(monogram);
      }
      nameCell.append(title);

      const codeCell = document.createElement('td');
      codeCell.textContent = project.code;
      const createdCell = document.createElement('td');
      createdCell.textContent = projectDate(project.created_at);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'project-actions';
      const actions = document.createElement('details');
      const summary = document.createElement('summary');
      summary.setAttribute('aria-label', `Actions for ${project.name}`);
      summary.textContent = '⋮';
      const menu = document.createElement('div');
      menu.className = 'project-actions-menu';
      menu.append(
        makeAction('Edit', '', () => {
          form.dataset.projectId = project.id;
          nameInput.value = project.name;
          codeInput.value = project.code;
          logoInput.value = project.logo || '';
          document.getElementById('project-modal-title').textContent = 'Edit project';
          form.querySelector('[type=submit]').textContent = 'Save changes';
          modalError.hidden = true;
          showModal();
        }),
        makeAction('Delete', 'delete-project', async () => {
          if (!window.confirm(`Delete project ${project.name} and its suites?`)) return;
          try {
            await responseData(await request(`/api/projects/${project.id}/`, {method: 'DELETE'}));
            await load();
          } catch (requestError) {
            error.textContent = requestError.message;
            error.hidden = false;
          }
        }),
      );
      actions.append(summary, menu);
      actionsCell.append(actions);
      row.append(nameCell, codeCell, createdCell, actionsCell);
      list.append(row);
    });
  }
  async function load() {
    error.hidden = true;
    const data = await responseData(await request('/api/projects/'));
    projects = data.projects;
    render();
  }

  function resetForm() {
    form.reset();
    delete form.dataset.projectId;
    document.getElementById('project-modal-title').textContent = 'Create project';
    form.querySelector('[type=submit]').textContent = 'Create project';
    modalError.hidden = true;
  }
  document.getElementById('add-project').addEventListener('click', () => {
    resetForm();
    showModal();
  });
  modal.querySelectorAll('[data-dismiss="modal"]').forEach((button) => {
    // Prevent the Bootstrap data API (bound to a different jQuery instance)
    // from also trying to close this modal.
    button.removeAttribute('data-dismiss');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      hideModal();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) hideModal();
  });
  search.addEventListener('input', render);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    modalError.hidden = true;
    const projectId = form.dataset.projectId;
    const url = projectId ? `/api/projects/${projectId}/` : '/api/projects/';
    const method = projectId ? 'PATCH' : 'POST';
    try {
      await responseData(await request(url, {
        method,
        body: JSON.stringify({
          name: nameInput.value,
          code: codeInput.value,
          logo: logoInput.value,
        }),
      }));
      hideModal();
      resetForm();
      await load();
    } catch (requestError) {
      modalError.textContent = requestError.message;
      modalError.hidden = false;
    }
  });
  load().catch((loadError) => {
    error.textContent = loadError.message;
    error.hidden = false;
    count.textContent = 'Projects could not be loaded';
  });
}());
