import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <p class="eyebrow">HOME.CONF / EVALUATION LAB</p>
    <h1>Flow skills, under pressure.</h1>
    <p class="lede">A deterministic Q/A harness for checking whether an agent can apply the shared flow lifecycle, review gate, and retrospective rules.</p>
    <div class="grid">
      <section><span>01</span><h2>Hierarchical context</h2><p>Role → task → loaded skills → question.</p></section>
      <section><span>02</span><h2>Frozen prefix</h2><p>One stable system prefix keeps repeated runs cache-friendly.</p></section>
      <section><span>03</span><h2>Vieval Q/A</h2><p>Run the live cases with <code>vp run eval</code>.</p></section>
    </div>
  </main>
`;
