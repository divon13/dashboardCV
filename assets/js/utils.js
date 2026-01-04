/**
 * Retorna a cor baseada na pontuação
 * @param {number} nota - Pontuação de 0 a 100
 * @returns {string} Cor em formato hex
 */
function getCorPorPontuacao(nota) {
    if (nota >= 67) return '#28a745'; // Verde para alta
    if (nota >= 34) return '#ffc107'; // Amarelo para média
    return '#dc3545'; // Vermelho para baixa
}

/**
 * Formata uma data ISO para o formato angolano com hora (fuso horário UTC+1)
 * @param {string} dataISO - Data no formato ISO
 * @returns {string} Data formatada (DD/MM/AAAA (HH:MM))
 */
function formatarData(dataISO) {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    if (isNaN(data.getTime())) return dataISO;

    // Converte para o fuso horário de Angola (Africa/Luanda - UTC+1)
    const formatter = new Intl.DateTimeFormat('pt-AO', {
        timeZone: 'Africa/Luanda',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const partes = formatter.formatToParts(data);
    const dia = partes.find(p => p.type === 'day').value;
    const mes = partes.find(p => p.type === 'month').value;
    const ano = partes.find(p => p.type === 'year').value;
    const hora = partes.find(p => p.type === 'hour').value;
    const min = partes.find(p => p.type === 'minute').value;

    return `${dia}/${mes}/${ano} (${hora}:${min})`;
}

/**
 * Configura todos os event handlers dos modais genéricos
 */
function configurarModais() {
    const elementos = {
        btnAbrirModal: document.getElementById('btnAbrirModal'),
        vagaModal: document.getElementById('vagaModal'),
        btnFecharModal: document.getElementById('btnFecharModal'),
        btnCancelar: document.getElementById('btnCancelar'),
        confirmDeleteModal: document.getElementById('confirmDeleteModal'),
        fecharConfirmDelete: document.getElementById('fecharConfirmDelete'),
        cancelarDeleteBtn: document.getElementById('cancelarDeleteBtn'),
        confirmarDeleteBtn: document.getElementById('confirmarDeleteBtn'),
        detalhesModal: document.getElementById('vagaDetalhesModal'),
        fecharDetalhes: document.getElementById('fecharDetalhes'),
        fecharDetalhesBtn: document.getElementById('fecharDetalhesBtn')
    };

    // Modal de criação/edição de vaga
    if (elementos.btnAbrirModal && elementos.vagaModal) {
        elementos.btnAbrirModal.onclick = function () {
            if (document.getElementById('vagaForm')) {
                document.getElementById('vagaForm').reset();
                document.getElementById('vagaId').value = '';
            }
            elementos.vagaModal.style.display = 'flex';
        };
    }

    if (elementos.btnFecharModal && elementos.vagaModal) {
        elementos.btnFecharModal.onclick = function () {
            elementos.vagaModal.style.display = 'none';
        };
    }

    if (elementos.btnCancelar && elementos.vagaModal) {
        elementos.btnCancelar.onclick = function (e) {
            e.preventDefault();
            elementos.vagaModal.style.display = 'none';
        };
    }

    // Modal de confirmação de exclusão
    if (elementos.fecharConfirmDelete && elementos.confirmDeleteModal) {
        elementos.fecharConfirmDelete.onclick = function () {
            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    if (elementos.cancelarDeleteBtn && elementos.confirmDeleteModal) {
        elementos.cancelarDeleteBtn.onclick = function () {
            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    if (elementos.confirmarDeleteBtn && elementos.confirmDeleteModal) {
        elementos.confirmarDeleteBtn.onclick = async function () {
            const id = this.getAttribute('data-id');
            if (!id) return;

            const { error } = await supabaseClient
                .from('Vagas')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Erro ao apagar vaga: ' + error.message);
            } else {
                if (typeof carregarVagas === 'function') carregarVagas();
            }

            elementos.confirmDeleteModal.style.display = 'none';
        };
    }

    // Modal de detalhes
    if (elementos.fecharDetalhes && elementos.detalhesModal) {
        elementos.fecharDetalhes.onclick = function () {
            elementos.detalhesModal.style.display = 'none';
        };
    }

    if (elementos.fecharDetalhesBtn && elementos.detalhesModal) {
        elementos.fecharDetalhesBtn.onclick = function () {
            elementos.detalhesModal.style.display = 'none';
        };
    }

    // Fecha modais ao clicar fora do conteúdo
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

    // Fecha modais com tecla ESC
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
