(function(){
  'use strict';

  /* ================= Utilities ================= */

  function escapeHtml(str){
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function formatSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  function formatMoney(n){
    return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatShortDate(d){
    return MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
  }
  function formatFullDate(d){
    return MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function monthKey(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
  }
  function monthLabel(d){
    return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ================= Categories ================= */

  var CATEGORIES = {
    tax:        {label:'Tax',        color:'#F5B942'},
    utilities:  {label:'Utilities',  color:'#3EC1D3'},
    banking:    {label:'Banking',    color:'#9B7CF2'},
    insurance:  {label:'Insurance',  color:'#34D0BA'},
    medical:    {label:'Medical',    color:'#F2637A'},
    housing:    {label:'Housing',    color:'#F5924A'},
    receipts:   {label:'Receipts',   color:'#8A93A3'},
    uncategorized: {label:'Uncategorized', color:'#565F6E'}
  };

  function fileIconSvg(){
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  function bigFileIconSvg(){
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  var docs = [];

  /* ================= State ================= */

  var state = {
    search: '',
    senderFilter: null,
    categoryFilter: null,
    yearFilter: null,
    checked: new Set(),
    previewId: null
  };

  /* ================= Derived data ================= */

  function bySenderName(){
    var map = {};
    docs.forEach(function(d){
      var key = d.sender.name;
      if(!map[key]) map[key] = {name:d.sender.name, initials:d.sender.initials, count:0};
      map[key].count++;
    });
    return Object.values(map).sort(function(a,b){ return b.count - a.count; });
  }

  function byCategory(){
    var map = {};
    docs.forEach(function(d){
      if(!map[d.category]) map[d.category] = {key:d.category, count:0};
      map[d.category].count++;
    });
    return Object.keys(CATEGORIES).map(function(k){
      return map[k] ? map[k] : {key:k, count:0};
    }).filter(function(c){ return c.count > 0; });
  }

  function allYears(){
    var set = new Set();
    docs.forEach(function(d){ set.add(d.date.getFullYear()); });
    return Array.from(set).sort(function(a,b){ return b-a; });
  }

  function filteredDocs(){
    var q = state.search.trim().toLowerCase();
    return docs.filter(function(d){
      if(state.senderFilter && d.sender.name !== state.senderFilter) return false;
      if(state.categoryFilter && d.category !== state.categoryFilter) return false;
      if(state.yearFilter && d.date.getFullYear() !== state.yearFilter) return false;
      if(q){
        var hay = (d.filename + ' ' + d.sender.name + ' ' + d.email.subject).toLowerCase();
        if(hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ================= Rendering ================= */

  var senderListEl = document.getElementById('senderList');
  var categoryListEl = document.getElementById('categoryList');
  var yearChipsEl = document.getElementById('yearChips');
  var clearFiltersBtn = document.getElementById('clearFilters');
  var resultCountEl = document.getElementById('resultCount');
  var selectAllBtn = document.getElementById('selectAllBtn');
  var tableBodyEl = document.getElementById('tableBody');
  var bulkBarEl = document.getElementById('bulkBar');
  var bulkSummaryEl = document.getElementById('bulkSummary');
  var previewPanelEl = document.getElementById('previewPanel');
  var appBodyEl = document.getElementById('appBody');
  var searchInputEl = document.getElementById('searchInput');

  function renderSidebar(){
    var senders = bySenderName();
    senderListEl.innerHTML = senders.map(function(s){
      var active = state.senderFilter === s.name;
      return '<button class="facet-row'+(active?' active':'')+'" data-sender="'+escapeHtml(s.name)+'">'+
        '<span class="facet-avatar">'+escapeHtml(s.initials)+'</span>'+
        '<span class="facet-label">'+escapeHtml(s.name)+'</span>'+
        '<span class="facet-count">'+s.count+'</span>'+
        '</button>';
    }).join('');

    var cats = byCategory();
    categoryListEl.innerHTML = cats.map(function(c){
      var meta = CATEGORIES[c.key];
      var active = state.categoryFilter === c.key;
      return '<button class="facet-row'+(active?' active':'')+'" data-category="'+c.key+'" style="--cat:'+meta.color+'">'+
        '<span class="facet-dot"></span>'+
        '<span class="facet-label">'+escapeHtml(meta.label)+'</span>'+
        '<span class="facet-count">'+c.count+'</span>'+
        '</button>';
    }).join('');

    var years = allYears();
    yearChipsEl.innerHTML = years.map(function(y){
      var active = state.yearFilter === y;
      return '<button class="year-chip'+(active?' active':'')+'" data-year="'+y+'">'+y+'</button>';
    }).join('');

    var anyFilter = state.senderFilter || state.categoryFilter || state.yearFilter || state.search;
    clearFiltersBtn.hidden = !anyFilter;
  }

  function renderTable(){
    var list = filteredDocs();
    resultCountEl.innerHTML = '<b>'+list.length+'</b> document'+(list.length===1?'':'s');

    if(list.length === 0){
      tableBodyEl.innerHTML = '<div class="empty-state">no documents match these filters</div>';
      selectAllBtn.textContent = '';
      renderBulkBar();
      return;
    }

    var html = '';
    var currentMonth = null;
    list.forEach(function(d){
      var mk = monthKey(d.date);
      if(mk !== currentMonth){
        currentMonth = mk;
        html += '<div class="month-header">'+monthLabel(d.date)+'</div>';
      }
      var meta = CATEGORIES[d.category];
      var checked = state.checked.has(d.id);
      var selected = state.previewId === d.id;
      html += '<div class="doc-row'+(checked?' checked':'')+(selected?' selected':'')+' unseen" data-id="'+d.id+'" role="row" tabindex="0">'+
        '<div class="cell-check"><input type="checkbox" data-check="'+d.id+'" '+(checked?'checked':'')+' aria-label="Select '+escapeHtml(d.filename)+'"></div>'+
        '<div class="cell-name">'+
          '<span class="file-icon" style="--cat:'+meta.color+'">'+fileIconSvg()+'</span>'+
          '<span class="cell-filename">'+escapeHtml(d.filename)+'</span>'+
        '</div>'+
        '<div class="cell-sender">'+escapeHtml(d.sender.name)+'</div>'+
        '<div class="cat-tag" style="--cat:'+meta.color+'"><span class="facet-dot"></span>'+escapeHtml(meta.label)+'</div>'+
        '<div class="cell-date">'+formatShortDate(d.date)+'</div>'+
        '<div class="cell-size">'+formatSize(d.size)+'</div>'+
        '</div>';
    });
    tableBodyEl.innerHTML = html;

    var allChecked = list.length > 0 && list.every(function(d){ return state.checked.has(d.id); });
    selectAllBtn.textContent = allChecked ? 'Deselect all' : 'Select all ' + list.length + ' in view';

    renderBulkBar();
  }

  function renderBulkBar(){
    var checkedDocs = docs.filter(function(d){ return state.checked.has(d.id); });
    if(checkedDocs.length === 0){
      bulkBarEl.hidden = true;
      return;
    }
    bulkBarEl.hidden = false;
    var totalBytes = checkedDocs.reduce(function(sum,d){ return sum + d.size; }, 0);
    bulkSummaryEl.innerHTML = '<b>'+checkedDocs.length+'</b> selected · '+formatSize(totalBytes)+' total';
  }

  function renderPreview(){
    if(!state.previewId){
      appBodyEl.classList.remove('preview-open');
      previewPanelEl.innerHTML = '';
      return;
    }
    var d = docs.find(function(x){ return x.id === state.previewId; });
    if(!d){
      appBodyEl.classList.remove('preview-open');
      previewPanelEl.innerHTML = '';
      return;
    }
    appBodyEl.classList.add('preview-open');
    var meta = CATEGORIES[d.category];

    var metaRows = '';
    metaRows += '<div class="preview-meta-row"><span class="k">Sender</span><span class="v">'+escapeHtml(d.sender.name)+'</span></div>';
    metaRows += '<div class="preview-meta-row"><span class="k">Date</span><span class="v">'+formatFullDate(d.date)+'</span></div>';
    metaRows += '<div class="preview-meta-row"><span class="k">Size</span><span class="v">'+formatSize(d.size)+'</span></div>';
    if(d.amount){
      metaRows += '<div class="preview-meta-row"><span class="k">Amount</span><span class="v">'+formatMoney(parseFloat(d.amount))+'</span></div>';
    }

    previewPanelEl.innerHTML =
      '<div class="preview-inner">'+
        '<div class="preview-top">'+
          '<button class="preview-close" id="previewCloseBtn" aria-label="Close preview">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'+
          '</button>'+
        '</div>'+
        '<div class="preview-icon" style="--cat:'+meta.color+'">'+bigFileIconSvg()+'</div>'+
        '<div class="preview-filename">'+escapeHtml(d.filename)+'</div>'+
        '<div class="preview-cat cat-tag" style="--cat:'+meta.color+'"><span class="facet-dot"></span>'+escapeHtml(meta.label)+'</div>'+
        '<div class="preview-meta">'+metaRows+'</div>'+
        '<div class="preview-actions">'+
          '<button class="btn-download" id="previewDownloadBtn">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
            'Download'+
          '</button>'+
          '<button class="btn-secondary">Close</button>'+
        '</div>'+
        '<div class="email-block" id="emailBlock">'+
          '<div class="email-label">'+
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 6h18v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" stroke="currentColor" stroke-width="1.6"/><path d="M3 6l9 7 9-7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'+
            'Received via email'+
          '</div>'+
          '<div class="email-subject">'+escapeHtml(d.email.subject)+'</div>'+
          '<div class="email-from">'+escapeHtml(d.email.from)+' · '+formatFullDate(d.email.date)+'</div>'+
          '<div class="email-snippet">'+escapeHtml(d.email.snippet)+'</div>'+
          (d.email.full ? '<div class="email-full">'+escapeHtml(d.email.full)+'</div>' : '')+
          (d.email.full ? '<button class="email-toggle" id="emailToggleBtn">View full email</button>' : '')+
        '</div>'+
      '</div>';
  }

  function renderAll(){
    renderSidebar();
    renderTable();
    renderPreview();
  }

  /* ================= Event wiring ================= */

  document.getElementById('sidebar').addEventListener('click', function(e){
    var senderBtn = e.target.closest('[data-sender]');
    if(senderBtn){
      var name = senderBtn.getAttribute('data-sender');
      state.senderFilter = state.senderFilter === name ? null : name;
      renderAll();
      if(window.innerWidth <= 900) appBodyEl.classList.remove('show-sidebar');
      return;
    }
    var catBtn = e.target.closest('[data-category]');
    if(catBtn){
      var key = catBtn.getAttribute('data-category');
      state.categoryFilter = state.categoryFilter === key ? null : key;
      renderAll();
      if(window.innerWidth <= 900) appBodyEl.classList.remove('show-sidebar');
      return;
    }
    var yearBtn = e.target.closest('[data-year]');
    if(yearBtn){
      var year = parseInt(yearBtn.getAttribute('data-year'), 10);
      state.yearFilter = state.yearFilter === year ? null : year;
      renderAll();
      if(window.innerWidth <= 900) appBodyEl.classList.remove('show-sidebar');
      return;
    }
  });

  clearFiltersBtn.addEventListener('click', function(){
    state.senderFilter = null;
    state.categoryFilter = null;
    state.yearFilter = null;
    state.search = '';
    searchInputEl.value = '';
    renderAll();
  });

  searchInputEl.addEventListener('input', function(){
    state.search = searchInputEl.value;
    renderTable();
    renderSidebar();
  });

  tableBodyEl.addEventListener('click', function(e){
    var checkbox = e.target.closest('[data-check]');
    if(checkbox){
      var id = checkbox.getAttribute('data-check');
      if(state.checked.has(id)) state.checked.delete(id);
      else state.checked.add(id);
      renderTable();
      return;
    }
    var row = e.target.closest('.doc-row');
    if(row){
      var rowId = row.getAttribute('data-id');
      state.previewId = state.previewId === rowId ? null : rowId;
      renderTable();
      renderPreview();
    }
  });

  tableBodyEl.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('.doc-row');
    if(!row) return;
    e.preventDefault();
    var rowId = row.getAttribute('data-id');
    state.previewId = state.previewId === rowId ? null : rowId;
    renderTable();
    renderPreview();
  });

  selectAllBtn.addEventListener('click', function(){
    var list = filteredDocs();
    var allChecked = list.length > 0 && list.every(function(d){ return state.checked.has(d.id); });
    if(allChecked){
      list.forEach(function(d){ state.checked.delete(d.id); });
    } else {
      list.forEach(function(d){ state.checked.add(d.id); });
    }
    renderTable();
  });

  document.getElementById('clearSelection').addEventListener('click', function(){
    state.checked.clear();
    renderTable();
  });

  document.getElementById('downloadZip').addEventListener('click', function(){
    var ids = docs.filter(function(d){ return state.checked.has(d.id); }).map(function(d){ return d.id; });
    if(ids.length) window.location.href = '/api/documents/zip?ids=' + ids.map(encodeURIComponent).join(',');
  });

  previewPanelEl.addEventListener('click', function(e){
    if(e.target.closest('#previewCloseBtn') || e.target.closest('.btn-secondary')){
      state.previewId = null;
      renderTable();
      renderPreview();
      return;
    }
    if(e.target.closest('#previewDownloadBtn')){
      var d = docs.find(function(x){ return x.id === state.previewId; });
      if(d) window.location.href = '/api/documents/' + encodeURIComponent(d.id) + '/download';
      return;
    }
    if(e.target.closest('#emailToggleBtn')){
      var block = document.getElementById('emailBlock');
      var expanded = block.classList.toggle('expanded');
      e.target.textContent = expanded ? 'Show less' : 'View full email';
      return;
    }
  });

  var sidebarToggleBtn = document.getElementById('sidebarToggle');
  sidebarToggleBtn.addEventListener('click', function(){
    appBodyEl.classList.toggle('show-sidebar');
  });

  /* ================= Data loading ================= */

  function loadDocuments(){
    tableBodyEl.innerHTML = '<div class="empty-state">loading documents…</div>';
    return fetch('/api/documents').then(function(res){
      if(!res.ok) throw new Error('request failed');
      return res.json();
    }).then(function(data){
      docs = data.map(function(d){
        d.date = new Date(d.date);
        d.email.date = new Date(d.email.date);
        return d;
      });
      docs.sort(function(a,b){ return b.date - a.date; });
      renderAll();
      checkPdfLocks();
    }).catch(function(){
      tableBodyEl.innerHTML = '<div class="empty-state">couldn\'t load documents. <button id="retryLoad" style="cursor:pointer;">Retry</button></div>';
      var retry = document.getElementById('retryLoad');
      if(retry) retry.addEventListener('click', loadDocuments);
    });
  }

  function refreshStatus(){
    var dot = document.getElementById('syncDot');
    var text = document.getElementById('syncText');
    if(!dot || !text) return;
    fetch('/api/status').then(function(res){ return res.json(); }).then(function(s){
      if(s.scanning){ text.textContent = 'syncing…'; dot.style.background = ''; }
      else if(!s.configured){ text.textContent = 'not configured'; dot.style.background = 'var(--text-tertiary)'; }
      else if(s.error){ text.textContent = 'error: '+s.error; dot.style.background = 'var(--danger)'; }
      else if(s.connected){ text.textContent = s.messageCount+' documents synced'; dot.style.background = ''; }
      else{ text.textContent = 'not synced'; dot.style.background = 'var(--text-tertiary)'; }
    }).catch(function(){});
  }

  /* ================= Sync with SSE ================= */

  function startSync(){
    var btn = document.getElementById('syncBtn');
    var dot = document.getElementById('syncDot');
    var text = document.getElementById('syncText');
    if(!btn || !dot || !text) return;

    btn.disabled = true;
    btn.textContent = '…';
    dot.style.display = 'inline-block';
    text.textContent = 'syncing…';

    fetch('/api/sync', { method: 'POST' })
      .then(function(res){
        if(!res.ok) throw new Error('sync failed');
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';

        function read(){
          reader.read().then(function(result){
            if(result.done){
              loadDocuments();
              text.textContent = 'sync complete';
              dot.style.display = 'none';
              btn.disabled = false;
              btn.textContent = 'Sync';
              return;
            }
            buf += decoder.decode(result.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop() || '';

            lines.forEach(function(line){
              line = line.trim();
              if(line && line.startsWith('data: ')){
                try {
                  var msg = JSON.parse(line.slice(6));
                  if(msg.type === 'progress'){
                    text.textContent = msg.scanned + '/' + msg.total;
                  } else if(msg.type === 'complete'){
                    text.textContent = msg.status.messageCount + ' documents synced';
                  } else if(msg.type === 'error'){
                    text.textContent = 'error: ' + msg.error;
                    dot.style.background = 'var(--danger)';
                  }
                } catch(e) {}
              }
            });
            read();
          }).catch(function(){
            text.textContent = 'sync failed';
            dot.style.display = 'inline-block';
            dot.style.background = 'var(--danger)';
            btn.disabled = false;
            btn.textContent = 'Sync';
          });
        }
        read();
      })
      .catch(function(){
        text.textContent = 'sync failed';
        dot.style.display = 'inline-block';
        dot.style.background = 'var(--danger)';
        btn.disabled = false;
        btn.textContent = 'Sync';
      });
  }

  /* ================= Drawer preview ================= */

  function openDrawer(docId){
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawerOverlay');
    var title = document.getElementById('drawerTitle');
    var content = document.getElementById('drawerContent');

    var doc = docs.find(function(d){ return d.id === docId; });
    if(!doc) return;

    console.log('[drawer] Opening', docId, doc.filename);
    title.textContent = doc.filename;
    content.innerHTML = '';

    // Preview container
    var previewContainer = document.createElement('div');
    previewContainer.className = 'drawer-preview-container';
    var previewBox = document.createElement('div');
    previewBox.className = 'drawer-preview-box';
    previewBox.textContent = 'Loading…';
    previewContainer.appendChild(previewBox);
    content.appendChild(previewContainer);

    fetch('/api/documents/' + encodeURIComponent(docId) + '/preview')
      .then(function(res){
        console.log('[drawer] Fetch status:', res.status);
        if(!res.ok) throw new Error('HTTP ' + res.status);
        var ct = res.headers.get('content-type');
        if(ct && (ct.includes('application/pdf') || ct.includes('image/jpeg') || ct.includes('image/jpg'))){
          return res.blob().then(function(blob){
            console.log('[drawer] Got blob:', blob.size, 'bytes');
            previewBox.innerHTML = '';
            if(ct.includes('application/pdf')){
              if(!window.pdfjsLib){
                previewBox.textContent = 'PDF.js not loaded';
                return;
              }
              var canvas = document.createElement('canvas');
              canvas.className = 'drawer-preview-canvas';
              previewBox.appendChild(canvas);

              var reader = new FileReader();
              reader.onload = function(e){
                var pdf = window.pdfjsLib.getDocument(e.target.result);
                pdf.promise.then(function(pdfDoc){
                  pdfDoc.getPage(1).then(function(page){
                    var scale = 1.2;
                    var viewport = page.getViewport({ scale: scale });
                    var ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    page.render({ canvasContext: ctx, viewport: viewport });
                  }).catch(function(err){
                    previewBox.textContent = 'Render error';
                  });
                }).catch(function(err){
                  if(err.name === 'PasswordException'){
                    previewBox.textContent = '🔒 Password protected';
                  } else {
                    previewBox.textContent = 'Load error';
                  }
                });
              };
              reader.readAsArrayBuffer(blob);
            } else {
              var url = URL.createObjectURL(blob);
              var img = document.createElement('img');
              img.src = url;
              img.className = 'drawer-preview-img';
              previewBox.appendChild(img);
            }
          });
        } else {
          previewBox.textContent = 'No preview available';
        }
      })
      .catch(function(err){
        console.error('[drawer] Error:', err);
        previewBox.textContent = 'Preview unavailable';
      });

    // Metadata
    var meta = document.createElement('div');
    meta.className = 'drawer-meta';
    meta.innerHTML = '<div class="drawer-meta-row"><div class="drawer-meta-key">Size:</div><div class="drawer-meta-val">'+formatSize(doc.size)+'</div></div>' +
      '<div class="drawer-meta-row"><div class="drawer-meta-key">From:</div><div class="drawer-meta-val">'+escapeHtml(doc.sender.name)+'</div></div>' +
      '<div class="drawer-meta-row"><div class="drawer-meta-key">Date:</div><div class="drawer-meta-val">'+formatFullDate(doc.date)+'</div></div>' +
      '<div class="drawer-meta-row"><div class="drawer-meta-key">Subject:</div><div class="drawer-meta-val">'+escapeHtml(doc.email.subject)+'</div></div>';
    content.appendChild(meta);

    state.activeDocId = docId;
    drawer.classList.add('open');
    overlay.classList.add('open');
  }

  function closeDrawer(){
    state.activeDocId = null;
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawerOverlay');
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }

  /* ================= Init ================= */

  loadDocuments();
  refreshStatus();
  setInterval(refreshStatus, 5000);

  // Sync button + drawer close
  var syncBtn = document.getElementById('syncBtn');
  var drawerClose = document.getElementById('drawerClose');
  var drawerOverlay = document.getElementById('drawerOverlay');

  if(syncBtn) syncBtn.addEventListener('click', startSync);
  if(drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if(drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  // Check PDF lock status on load
  function checkPdfLocks(){
    docs.forEach(function(doc){
      if(doc.filename.toLowerCase().endsWith('.pdf')){
        var id = doc.id;
        fetch('/api/documents/' + encodeURIComponent(id) + '/locked')
          .then(function(res){ return res.json(); })
          .then(function(data){
            if(data.locked){
              doc._locked = true;
              var row = document.querySelector('[data-id="' + id + '"]');
              if(row){
                var lockEl = row.querySelector('.pdf-lock');
                if(!lockEl){
                  var lock = document.createElement('span');
                  lock.className = 'pdf-lock';
                  lock.textContent = '🔒';
                  lock.title = 'Password protected PDF';
                  var filename = row.querySelector('[data-sort="filename"]');
                  if(filename) filename.insertAdjacentElement('afterend', lock);
                }
              }
            }
          })
          .catch(function(){});
      }
    });
  }

  state.activeDocId = null; // Currently open document in drawer

  // Document click to toggle drawer
  document.addEventListener('click', function(e){
    var row = e.target.closest('.doc-row');
    if(row && !e.target.closest('a') && e.target.tagName !== 'BUTTON' && !e.target.closest('[type="checkbox"]')){
      var id = row.getAttribute('data-id');
      if(state.activeDocId === id){
        closeDrawer();
      } else {
        openDrawer(id);
      }
    }
  });
})();
