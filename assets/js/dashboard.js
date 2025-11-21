async function carregarUsuarios() {
  const { data, error } = await supabaseClient
    .from("candidatos")
    .select("*");

  if (error) {
    console.error("Erro ao carregar:", error);
    return;
  }

  const tbody = document.querySelector("#candidatesTable tbody");
  if (!tbody) {
    console.error("Tabela não encontrada: #candidatesTable tbody");
    return;
  }
  tbody.innerHTML = "";

  data.forEach(candidatos => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td>${candidatos.nome}</td>
    <td>${candidatos.email}</td>
    <td>${candidatos.Endereco}</td>
    <td>${candidatos.nota}</td>
    <td>${candidatos.vaga_sugerida}</td>
    `;

    tbody.appendChild(tr);
  });
}

carregarUsuarios();

async function carregarCandidatos() {
  const { count, error } = await supabaseClient.from("candidatos").select("*", { count: "exact" });
  
  if (error) {
    console.error("Erro ao carregar contagem de candidatos:", error);
    return;
  } else {
    const totalCandidatos = count || 0;
    const candidateCountElement = document.querySelector(".card:first-child p")
    if (candidateCountElement) {
      candidateCountElement.textContent = totalCandidatos;
    }
  }
}

carregarCandidatos();
