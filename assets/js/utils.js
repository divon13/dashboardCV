/**
 * utils.js
 * ─────────────────────────────────────────────────────────────
 * Funções utilitárias partilhadas por toda a aplicação.
 *
 * Este ficheiro contém:
 *   1. getCorPorPontuacao()  → Retorna uma cor baseada na nota do candidato
 *   2. formatarData()        → Formata datas ISO para o padrão angolano (UTC+1)
 *   3. configurarModais()    → Configura os event handlers dos modais de Vagas
 *
 * Todas as funções aqui definidas são globais e podem ser chamadas
 * por qualquer outro script carregado na mesma página.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Retorna uma cor hexadecimal baseada na pontuação (nota) do candidato.
 * Usada para colorir o círculo de pontuação nos cards e no modal.
 *
 * Escala de cores:
 *   - Verde  (#28a745): nota >= 67 → candidato bem qualificado
 *   - Amarelo (#ffc107): nota >= 34 → qualificação média
 *   - Vermelho (#dc3545): nota < 34  → baixa qualificação
 *
 * @param {number} nota - Pontuação de 0 a 100
 * @returns {string} Cor em formato hexadecimal
 */
function getCorPorPontuacao(nota) {
    if (nota >= 67) return '#28a745'; // Verde para alta pontuação
    if (nota >= 34) return '#ffc107'; // Amarelo para pontuação média
    return '#dc3545'; // Vermelho para baixa pontuação
}

/**
 * Formata uma string de data ISO 8601 para o formato legível angolano,
 * ajustando para o fuso horário de Angola (Africa/Luanda, UTC+1).
 *
 * Exemplo de entrada:  "2025-01-15T10:30:00Z"
 * Exemplo de saída:    "15/01/2025 (11:30)"
 *
 * Utiliza a API Intl.DateTimeFormat do browser para garantir
 * a conversão correta do fuso horário sem bibliotecas externas.
 *
 * @param {string} dataISO - Data no formato ISO 8601
 * @returns {string} Data formatada como "DD/MM/AAAA (HH:MM)" ou string vazia se inválida
 */
function formatarData(dataISO) {
    if (!dataISO) return ''; // Retorna vazio se não houver data
    const data = new Date(dataISO);
    if (isNaN(data.getTime())) return dataISO; // Retorna o valor original se não for uma data válida

    // Usa o fuso horário de Angola (Africa/Luanda - UTC+1)
    const formatter = new Intl.DateTimeFormat('pt-AO', {
        timeZone: 'Africa/Luanda',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Formato 24 horas
    });

    // Extrai cada parte da data formatada individualmente
    const partes = formatter.formatToParts(data);
    const dia = partes.find(p => p.type === 'day').value;
    const mes = partes.find(p => p.type === 'month').value;
    const ano = partes.find(p => p.type === 'year').value;
    const hora = partes.find(p => p.type === 'hour').value;
    const min = partes.find(p => p.type === 'minute').value;

    return `${dia}/${mes}/${ano} (${hora}:${min})`;
}

/**
 * Configura todos os event handlers dos modais relacionados com Vagas.
 *
 * Esta função é chamada uma vez no DOMContentLoaded (via dashboard.js)
 * e trata dos seguintes modais:
 *   - Modal de criação/edição de vaga (#vagaModal)
 *   - Modal de confirmação de exclusão (#confirmDeleteModal)
 *   - Modal de detalhes da vaga (#vagaDetalhesModal)
 *
 * Cada modal pode ser fechado de 3 formas:
 *   1. Clicando no botão "X" ou "Cancelar"
 *   2. Clicando fora do conteúdo do modal (no overlay escuro)
 *   3. Premindo a tecla ESC
 *
 * A função verifica a existência de cada elemento antes de adicionar
 * listeners, tornando-a segura para páginas que não têm todos os modais.
 */
function configurarModais() {
    // Recolhe referências a todos os elementos dos modais de uma vez
    const elementos = {
        btnAbrirModal: document.getElementById('btnAbrirModal'),         // Botão "Adicionar Vaga"
        vagaModal: document.getElementById('vagaModal'),                  // Modal de criar/editar vaga
        btnFecharModal: document.getElementById('btnFecharModal'),        // Botão "X" do modal de vaga
        btnCancelar: document.getElementById('btnCancelar'),              // Botão "Cancelar" do formulário
        confirmDeleteModal: document.getElementById('confirmDeleteModal'),// Modal de confirmação de exclusão
        fecharConfirmDelete: document.getElementById('fecharConfirmDelete'), // Botão "X" do modal de exclusão
        cancelarDeleteBtn: document.getElementById('cancelarDeleteBtn'),  // Botão "Cancelar" da exclusão
        confirmarDeleteBtn: document.getElementById('confirmarDeleteBtn'),// Botão "Apagar" da exclusão
        detalhesModal: document.getElementById('vagaDetalhesModal'),      // Modal de detalhes da vaga
        fecharDetalhes: document.getElementById('fecharDetalhes'),        // Botão "X" dos detalhes
        fecharDetalhesBtn: document.getElementById('fecharDetalhesBtn')   // Botão "Fechar" dos detalhes
    };

    // ── Modal de criação/edição de vaga ──────────────────────────────────
    // Ao clicar em "Adicionar Vaga": limpa o formulário e abre o modal
    if (elementos.btnAbrirModal && elementos.vagaModal) {
        elementos.btnAbrirModal.onclick = function () {
            if (document.getElementById('vagaForm')) {
                document.getElementById('vagaForm').reset(); // Limpa todos os campos
                document.getElementById('vagaId').value = ''; // Garante que não está em modo de edição
            }
            elementos.vagaModal.style.display = 'flex';
        };
    }

    // Fecha o modal ao clicar no "X"
    if (elementos.btnFecharModal && elementos.vagaModal) {
        elementos.btnFecharModal.onclick = function () {
            elementos.vagaModal.style.display = 'none';
        };
    }

    // Fecha o modal ao clicar em "Cancelar" (previne o submit do formulário)
    if (elementos.btnCancelar && elementos.vagaModal) {
        elementos.btnCancelar.onclick = function (e) {
            e.preventDefault(); // Impede que o formulário seja submetido
            elementos.vagaModal.style.display = 'none';
        };
    }

    // ── Modal de confirmação de exclusão ─────────────────────────────────
    // Fecha ao clicar no "X"
    if (elementos.fecharConfirmDelete && elementos.confirmDeleteModal) {
        elementos.fecharConfirmDelete.onclick = function () {
            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    // Fecha ao clicar em "Cancelar"
    if (elementos.cancelarDeleteBtn && elementos.confirmDeleteModal) {
        elementos.cancelarDeleteBtn.onclick = function () {
            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    // Executa a exclusão ao clicar em "Apagar"
    // O ID da vaga a eliminar é guardado no atributo data-id do botão
    if (elementos.confirmarDeleteBtn && elementos.confirmDeleteModal) {
        elementos.confirmarDeleteBtn.onclick = async function () {
            const id = this.getAttribute('data-id'); // Obtém o ID da vaga a eliminar
            if (!id) return;

            // Chama o Supabase para eliminar a vaga da tabela "Vagas"
            const { error } = await supabaseClient
                .from('Vagas')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Erro ao apagar vaga: ' + error.message);
            } else {
                // Recarrega a lista de vagas após a exclusão bem-sucedida
                if (typeof carregarVagas === 'function') carregarVagas();
            }

            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    // ── Modal de detalhes da vaga ─────────────────────────────────────────
    // Fecha ao clicar no "X"
    if (elementos.fecharDetalhes && elementos.detalhesModal) {
        elementos.fecharDetalhes.onclick = function () {
            elementos.detalhesModal.style.display = 'none';
        };
    }

    // Fecha ao clicar no botão "Fechar"
    if (elementos.fecharDetalhesBtn && elementos.detalhesModal) {
        elementos.fecharDetalhesBtn.onclick = function () {
            elementos.detalhesModal.style.display = 'none';
        };
    }

    // ── Fechar modais ao clicar no overlay (fora do conteúdo) ────────────
    // O evento é no `window` para capturar cliques em qualquer parte da página.
    // Verifica se o clique foi diretamente no elemento do modal (o overlay),
    // e não no conteúdo interno do modal.
    window.onclick = function (event) {
        if (elementos.vagaModal && event.target === elementos.vagaModal) {
            elementos.vagaModal.style.display = 'none';
        }
        if (elementos.confirmDeleteModal && event.target === elementos.confirmDeleteModal) {
            elementos.confirmDeleteModal.style.display = 'none';
        }
        if (elementos.detalhesModal && event.target === elementos.detalhesModal) {
            elementos.detalhesModal.style.display = 'none';
        }
    };

    // ── Fechar modais com a tecla ESC ─────────────────────────────────────
    // Verifica se o modal está visível (display === 'flex') antes de fechar,
    // para não interferir com outros comportamentos da tecla ESC.
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (elementos.vagaModal && elementos.vagaModal.style.display === 'flex') {
                elementos.vagaModal.style.display = 'none';
            }
            if (elementos.confirmDeleteModal && elementos.confirmDeleteModal.style.display === 'flex') {
                elementos.confirmDeleteModal.style.display = 'none';
            }
            if (elementos.detalhesModal && elementos.detalhesModal.style.display === 'flex') {
                elementos.detalhesModal.style.display = 'none';
            }
        }
    });
}
