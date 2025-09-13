export async function loadHTMLPartials() {
  const partials = [
    { id: 'header-container', path: 'transcribe-partials/header.html' },
    { id: 'left-column-container', path: 'transcribe-partials/left_column.html' },
    { id: 'right-column-container', path: 'transcribe-partials/right_column.html' },
    { id: 'footer-container', path: 'transcribe-partials/footer.html' },
    { id: 'modal-container', path: 'transcribe-partials/modal.html' }
  ];

  try {
    const fetchPromises = partials.map(p => 
      fetch(chrome.runtime.getURL(p.path)).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch ${p.path}: ${res.statusText}`);
        return res.text();
      })
    );
    const htmls = await Promise.all(fetchPromises);

    partials.forEach((p, i) => {
      const container = document.getElementById(p.id);
      if (container) {
        container.innerHTML = htmls[i];
      }
    });
  } catch (error) {
    console.error("Error loading HTML partials:", error);
    document.body.innerHTML = `<div style="color: red; padding: 20px;">Error loading page components. Please check the console.</div>`;
  }
}
