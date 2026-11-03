(function () {
  const tree = document.getElementById('suite-tree');
  const error = document.getElementById('tree-error');
  const navigation = document.getElementById('suite-navigation');
  const content = document.getElementById('suite-content');
  const suiteTotal = document.getElementById('suite-total');
  const search = document.getElementById('case-search');
  const suiteModal = document.getElementById('suite-modal');
  const suiteForm = document.getElementById('suite-form');
  const suiteTitleInput = document.getElementById('suite-title');
  const suiteParentSelect = document.getElementById('suite-parent');
  const suiteDescriptionInput = document.getElementById('suite-description');
  const suiteModalError = document.getElementById('suite-modal-error');
  const suiteSubmit = document.getElementById('suite-submit');
  const projectId = Number(tree.dataset.projectId);
  const projectCode = tree.dataset.projectCode;
  const csrf = suiteForm.querySelector('[name=csrfmiddlewaretoken]').value;
  const request = (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      ...(options.headers || {}),
    },
  });
  async function readResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (contentType.includes('application/json')) {
      try { return body ? JSON.parse(body) : {}; }
      catch (_) { throw new Error(`Respons API tidak berisi JSON yang valid (HTTP ${response.status}).`); }
    }

    const document = new DOMParser().parseFromString(body, 'text/html');
    const detail = document.querySelector('h1, h2, title')?.textContent?.trim();
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`Server mengembalikan halaman non-JSON (HTTP ${response.status})${suffix}.`);
  }

  let current;
  let selectedSuiteId = null;
  let suitesByParent = new Map();
  let suitesById = new Map();
  let casesBySuite = new Map();
  let expandedSuiteIds = new Set();
  let suiteBackdrop;
  const query = () => search.value.trim().toLocaleLowerCase();

  function directCases(suiteId) {
    return casesBySuite.get(suiteId) || [];
  }
  function children(suiteId) {
    return suitesByParent.get(suiteId) || [];
  }
  function totalCases(suiteId) {
    return directCases(suiteId).length
      + children(suiteId).reduce((total, child) => total + totalCases(child.id), 0);
  }
  function suiteMatches(suite, filter) {
    if (!filter) return true;
    if (suite.title.toLocaleLowerCase().includes(filter)) return true;
    if (directCases(suite.id).some((item) =>
      `${item.case_code} ${item.summary}`.toLocaleLowerCase().includes(filter),
    )) return true;
    return children(suite.id).some((child) => suiteMatches(child, filter));
  }
  function makeButton(label, className, handler, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    if (title) button.title = title;
    button.addEventListener('click', handler);
    return button;
  }
  function renderNavigation(suiteList, parent) {
    suiteList.forEach((suite) => {
      const filter = query();
      if (!suiteMatches(suite, filter)) return;
      const childSuites = children(suite.id);
      const item = document.createElement('div');
      const row = document.createElement('div');
      row.className = `suite-nav-item${suite.id === selectedSuiteId ? ' is-selected' : ''}`;
      if (childSuites.length) {
        const toggle = makeButton(
          expandedSuiteIds.has(suite.id) ? '⌄' : '›',
          'suite-nav-toggle',
          () => {
            if (expandedSuiteIds.has(suite.id)) expandedSuiteIds.delete(suite.id);
            else expandedSuiteIds.add(suite.id);
            render();
          },
          expandedSuiteIds.has(suite.id) ? 'Collapse suite' : 'Expand suite',
        );
        toggle.setAttribute('aria-expanded', String(expandedSuiteIds.has(suite.id)));
        row.append(toggle);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'suite-nav-spacer';
        row.append(spacer);
      }
      row.append(makeButton(
        suite.title,
        'suite-nav-label',
        () => {
          selectedSuiteId = suite.id;
          let ancestorId = suite.parent_suite;
          while (ancestorId !== null) {
            expandedSuiteIds.add(ancestorId);
            ancestorId = suitesById.get(ancestorId)?.parent_suite ?? null;
          }
          render();
        },
      ));
      const count = document.createElement('span');
      count.className = 'suite-nav-count';
      count.textContent = String(totalCases(suite.id));
      row.append(count);
      item.append(row);
      if (childSuites.length && expandedSuiteIds.has(suite.id)) {
        const nested = document.createElement('div');
        nested.className = 'suite-nav-children';
        renderNavigation(childSuites, nested);
        item.append(nested);
      }
      parent.append(item);
    });
  }
  function renderSuiteEntry(suite) {
    const row = document.createElement('div');
    row.className = 'suite-entry';
    const open = makeButton('', 'suite-entry-open', () => {
      selectedSuiteId = suite.id;
      expandedSuiteIds.add(suite.id);
      render();
    });
    const icon = document.createElement('i');
    icon.className = 'fa fa-angle-right';
    icon.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.className = 'suite-entry-title';
    title.textContent = suite.title;
    open.append(icon, title);
    const count = document.createElement('span');
    count.className = 'suite-entry-count';
    count.textContent = `${directCases(suite.id).length} direct, ${totalCases(suite.id)} total cases`;
    const actions = document.createElement('span');
    actions.className = 'suite-entry-actions';
    actions.append(
      makeButton('+', 'btn btn-link btn-xs', () => showSuiteModal(suite.id), 'Create child suite'),
      makeButton('✎', 'btn btn-link btn-xs', () => updateSuite(suite), 'Edit suite'),
    );
    if (suite.parent_suite !== null) {
      actions.append(makeButton('×', 'btn btn-link btn-xs', () => deleteSuite(suite), 'Delete suite'));
    }
    row.append(open, count, actions);
    return row;
  }
  function renderCaseEntry(item) {
    const row = document.createElement('div');
    row.className = 'case-entry';
    const link = document.createElement('a');
    link.className = 'case-entry-title';
    link.href = `/case/${encodeURIComponent(projectCode)}/${encodeURIComponent(item.case_code)}/`;
    link.textContent = item.summary || item.case_code;
    const code = document.createElement('span');
    code.className = 'case-entry-code';
    code.textContent = item.case_code;
    const actions = document.createElement('span');
    actions.className = 'case-entry-actions';
    const edit = document.createElement('a');
    edit.className = 'btn btn-link btn-xs';
    edit.href = `/case/${encodeURIComponent(projectCode)}/${encodeURIComponent(item.case_code)}/edit/`;
    edit.title = 'Edit testcase';
    edit.textContent = '✎';
    const remove = makeButton('×', 'btn btn-link btn-xs', () => deleteCase(item), 'Delete testcase');
    actions.append(edit, remove);
    row.append(link, code, actions);
    return row;
  }
  function renderContent(suite) {
    content.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'suite-content-heading';
    const title = document.createElement('h2');
    title.textContent = suite.title;
    const meta = document.createElement('span');
    meta.className = 'suite-heading-meta';
    meta.textContent = `${directCases(suite.id).length} direct, ${totalCases(suite.id)} total cases`;
    heading.append(title, meta);

    const quickActions = document.createElement('div');
    quickActions.className = 'suite-quick-actions';
    quickActions.append(
      makeButton('+ Create suite', 'btn btn-link btn-xs', () => showSuiteModal(suite.id)),
      document.createTextNode('  ·  '),
    );
    const createCase = document.createElement('a');
    createCase.href = `/cases/${encodeURIComponent(projectCode)}/new/`;
    createCase.textContent = '+ Create case';
    quickActions.append(createCase);

    const entries = document.createElement('div');
    entries.className = 'suite-entry-list';
    const filter = query();
    const matchingChildren = children(suite.id).filter((child) => suiteMatches(child, filter));
    const matchingCases = directCases(suite.id).filter((item) =>
      !filter || `${item.case_code} ${item.summary}`.toLocaleLowerCase().includes(filter),
    );
    matchingChildren.forEach((child) => entries.append(renderSuiteEntry(child)));
    matchingCases.forEach((item) => entries.append(renderCaseEntry(item)));

    content.append(heading, quickActions, entries);
    if (!matchingChildren.length && !matchingCases.length) {
      const message = document.createElement('div');
      message.className = 'suite-empty';
      message.textContent = filter ? 'Tidak ada suite atau testcase yang cocok.' : 'Belum ada suite atau testcase di folder ini.';
      content.append(message);
    }
  }
  function render() {
    if (!current) return;
    navigation.replaceChildren();
    const roots = current.suites.filter((suite) => suite.parent_suite === null);
    roots.forEach((root) => renderNavigation([root], navigation));
    suiteTotal.textContent = `${current.suites.length} suites · ${current.testcases.length} cases`;
    const selected = suitesById.get(selectedSuiteId) || roots[0];
    if (selected) {
      selectedSuiteId = selected.id;
      renderContent(selected);
    } else {
      content.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'suite-empty';
      empty.textContent = 'Project ini belum memiliki suite.';
      content.append(empty);
    }
  }
  async function load() {
    const response = await request(`/api/projects/${encodeURIComponent(projectCode)}/testcases/`);
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || `Gagal memuat data (HTTP ${response.status}).`);
    current = data;
    suitesByParent = new Map();
    suitesById = new Map(data.suites.map((suite) => [suite.id, suite]));
    casesBySuite = new Map();
    data.suites.forEach((suite) => {
      const siblings = suitesByParent.get(suite.parent_suite) || [];
      siblings.push(suite);
      suitesByParent.set(suite.parent_suite, siblings);
      casesBySuite.set(suite.id, []);
    });
    data.testcases.forEach((item) => {
      const suiteCases = casesBySuite.get(item.id_suite) || [];
      suiteCases.push(item);
      casesBySuite.set(item.id_suite, suiteCases);
    });
    if (!suitesById.has(selectedSuiteId)) {
      const roots = data.suites.filter((suite) => suite.parent_suite === null);
      selectedSuiteId = roots[0]?.id ?? null;
      expandedSuiteIds = new Set(roots.map((suite) => suite.id));
    }
    error.hidden = true;
    render();
  }
  function showSuiteModal(parentId) {
    if (!current) { showError('Data suite belum selesai dimuat. Silakan coba lagi.'); return; }
    suiteForm.reset();
    suiteModalError.hidden = true;
    suiteParentSelect.replaceChildren();
    const roots = current.suites.filter((suite) => suite.parent_suite === null);
    function pathFor(suite) {
      const parent = suite.parent_suite === null ? null : suitesById.get(suite.parent_suite);
      return parent ? `${pathFor(parent)} / ${suite.title}` : suite.title;
    }
    current.suites
      .slice()
      .sort((left, right) => pathFor(left).localeCompare(pathFor(right)))
      .forEach((suite) => {
        const option = document.createElement('option');
        option.value = suite.id;
        option.textContent = pathFor(suite);
        suiteParentSelect.append(option);
      });
    const defaultParent = suitesById.has(parentId) ? parentId : (roots[0]?.id ?? null);
    if (defaultParent !== null) suiteParentSelect.value = String(defaultParent);
    suiteModal.hidden = false;
    suiteModal.style.display = 'block';
    suiteModal.setAttribute('aria-hidden', 'false');
    suiteModal.classList.add('in');
    document.body.classList.add('modal-open');
    suiteBackdrop = document.createElement('div');
    suiteBackdrop.className = 'modal-backdrop fade in';
    suiteBackdrop.addEventListener('click', hideSuiteModal);
    document.body.append(suiteBackdrop);
    suiteTitleInput.focus();
  }
  function hideSuiteModal() {
    suiteModal.classList.remove('in');
    suiteModal.style.display = 'none';
    suiteModal.hidden = true;
    suiteModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    suiteBackdrop?.remove();
    suiteBackdrop = null;
  }
  async function createSuite(event) {
    event.preventDefault();
    suiteModalError.hidden = true;
    suiteSubmit.disabled = true;
    try {
      const response = await request('/api/suites/', {
        method: 'POST',
        body: JSON.stringify({
          title: suiteTitleInput.value.trim(),
          description: suiteDescriptionInput.value.trim(),
          id_project: projectId,
          parent_suite: Number(suiteParentSelect.value),
        }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || `Suite gagal dibuat (HTTP ${response.status}).`);
      selectedSuiteId = data.id;
      hideSuiteModal();
      await load();
    } catch (createError) {
      suiteModalError.textContent = createError.message;
      suiteModalError.hidden = false;
    } finally {
      suiteSubmit.disabled = false;
    }
  }
  async function updateSuite(suite) {
    const title = window.prompt('Nama suite', suite.title);
    if (title === null) return;
    let parent = suite.parent_suite;
    if (suite.parent_suite !== null) {
      const candidate = window.prompt('ID parent suite (kosong untuk Project root)', suite.parent_suite);
      if (candidate === null) return;
      parent = candidate.trim() ? Number(candidate) : null;
      if (parent !== null && !current.suites.some((item) => item.id === parent)) {
        showError('Parent suite tidak ditemukan di project ini.');
        return;
      }
    }
    const response = await request(`/api/suites/${suite.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({title, parent_suite: parent}),
    });
    const data = await readResponse(response);
    if (!response.ok) { showError(data.error || `Suite gagal diperbarui (HTTP ${response.status}).`); return; }
    load().catch((loadError) => showError(loadError.message));
  }
  async function deleteSuite(suite) {
    if (!window.confirm(`Hapus suite ${suite.title}?`)) return;
    const response = await request(`/api/suites/${suite.id}/`, {method: 'DELETE'});
    const data = await readResponse(response);
    if (!response.ok) { showError(data.error || `Suite gagal dihapus (HTTP ${response.status}).`); return; }
    selectedSuiteId = suite.parent_suite;
    load().catch((loadError) => showError(loadError.message));
  }
  async function deleteCase(item) {
    if (!window.confirm(`Hapus testcase ${item.case_code}?`)) return;
    const response = await request(`/api/projects/${encodeURIComponent(projectCode)}/testcases/${item.id}/`, {method: 'DELETE'});
    const data = await readResponse(response);
    if (!response.ok) { showError(data.error || `Testcase gagal dihapus (HTTP ${response.status}).`); return; }
    load().catch((loadError) => showError(loadError.message));
  }
  function showError(message) {
    error.hidden = false;
    error.textContent = message;
  }
  document.getElementById('add-suite').addEventListener('click', () => {
    const root = current?.suites.find((suite) => suite.parent_suite === null);
    showSuiteModal(selectedSuiteId ?? root?.id);
  });
  suiteForm.addEventListener('submit', createSuite);
  document.getElementById('suite-modal-close').addEventListener('click', hideSuiteModal);
  document.getElementById('suite-modal-cancel').addEventListener('click', hideSuiteModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !suiteModal.hidden) hideSuiteModal();
  });
  document.getElementById('clear-search').addEventListener('click', () => {
    search.value = '';
    render();
    search.focus();
  });
  search.addEventListener('input', render);
  document.getElementById('expand-suites').addEventListener('click', () => {
    expandedSuiteIds = new Set(current?.suites.map((suite) => suite.id) || []);
    render();
  });
  document.getElementById('collapse-suites').addEventListener('click', () => {
    expandedSuiteIds.clear();
    render();
  });
  document.getElementById('suite-filter').addEventListener('click', () => search.focus());
  load().catch((loadError) => showError(loadError.message));
}());
