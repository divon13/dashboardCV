Roadmap do Sistema de Gestão de Currículos
Contexto do Projeto
O sistema já possui:

✅ Backend completo (Supabase) com recepção de emails e análise de currículos por IA
✅ Estrutura básica do dashboard (4 páginas: Início, Candidatos, Vagas, Pipeline)
✅ CRUD completo de vagas
✅ Visualização básica de candidatos em tabela
✅ Visualização de próximas entrevistas no dashboard
Fase 1: Funcionalidades Críticas do Pipeline (Prioridade ALTA)
1.1 Implementar Pipeline Interativo com Drag-and-Drop
Arquivos a modificar:

assets/js/dashboard.js - Adicionar lógica de drag-and-drop
Pipeline.html - Verificar estrutura HTML
css/style.css - Adicionar estilos para drag-and-drop
Tarefas:

Carregar candidatos do Supabase agrupados por status (Aplicado, Triagem, Entrevista técnica, etc.)
Criar cards de candidatos dentro das colunas do pipeline
Implementar drag-and-drop usando HTML5 Drag API ou biblioteca (SortableJS)
Atualizar status do candidato no Supabase ao mover entre colunas
Atualizar contadores das colunas em tempo real
Adicionar feedback visual durante o arraste
Implementar persistência de mudanças no banco de dados
1.2 Carregar Candidatos no Pipeline
Arquivos a modificar:

assets/js/dashboard.js - Nova função carregarPipeline()
Tarefas:

Buscar candidatos do Supabase com campo status ou etapa_processo
Mapear status para as 6 colunas do pipeline
Renderizar cards de candidatos em cada coluna
Exibir informações essenciais: nome, vaga sugerida, nota da IA
Atualizar contadores no header e footer do pipeline
Fase 2: Visualização e Gestão de Candidatos (Prioridade ALTA)
2.1 Modal de Detalhes do Candidato
Arquivos a criar/modificar:

Candidatos.html - Adicionar modal de detalhes
assets/js/dashboard.js - Função para abrir/fechar modal e carregar dados
css/style.css - Estilos do modal de candidato
Tarefas:

Criar modal com informações completas do candidato
Exibir: nome, email, endereço, telefone, nota da IA, vaga sugerida
Mostrar justificativa da nota (se disponível no banco)
Exibir histórico de mudanças de status
Botão para visualizar currículo
Botão para editar informações (se necessário)
2.2 Visualização de Currículos
Arquivos a modificar:

assets/js/dashboard.js - Função para carregar e exibir currículo
Candidatos.html - Adicionar visualizador de PDF/imagem
Tarefas:

Buscar URL do currículo no Supabase (campo curriculo_url ou similar)
Implementar visualizador de PDF (usar PDF.js ou iframe)
Suportar visualização de imagens (JPG, PNG)
Adicionar botão de download do currículo
Tratar casos onde o currículo não está disponível
2.3 Busca e Filtros de Candidatos
Arquivos a modificar:

Candidatos.html - Adicionar barra de busca e filtros
assets/js/dashboard.js - Funções de busca e filtragem
css/style.css - Estilos dos controles de busca
Tarefas:

Adicionar campo de busca por nome/email
Filtros: por status, por vaga, por nota mínima, por data
Ordenação: nome, nota, data de cadastro
Atualizar tabela dinamicamente conforme filtros
Salvar filtros preferidos (localStorage)
Fase 3: Sistema de Entrevistas Completo (Prioridade MÉDIA)
3.1 CRUD de Entrevistas
Arquivos a modificar:

index.html ou criar Entrevistas.html - Modal/formulário de entrevistas
assets/js/dashboard.js - Funções CRUD de entrevistas
Tarefas:

Modal para criar nova entrevista
Formulário: selecionar candidato, vaga, data/hora, entrevistador, observações
Validação: evitar conflitos de horário, data não pode ser no passado
Editar entrevista existente
Cancelar entrevista (com confirmação)
Listar todas as entrevistas (não apenas próximas)
Integrar com pipeline (mover candidato automaticamente para "Entrevista técnica")
3.2 Calendário de Entrevistas
Arquivos a criar/modificar:

Nova seção ou página para calendário
assets/js/dashboard.js - Função para renderizar calendário
Tarefas:

Visualização mensal/semanal das entrevistas
Destaque para entrevistas do dia
Navegação entre meses
Clicar em data para criar nova entrevista
Fase 4: Respostas Automáticas (Prioridade MÉDIA)
4.1 Sistema de Templates de Email
Arquivos a criar/modificar:

Nova página Templates.html ou seção em configurações
assets/js/dashboard.js - Funções para gerenciar templates
Tarefas:

CRUD de templates de email
Templates padrão: aprovação, rejeição, agendamento de entrevista
Variáveis dinâmicas: {nome}, {vaga}, {data_entrevista}
Preview do template antes de enviar
Salvar templates no Supabase (tabela email_templates)
4.2 Envio de Respostas Automáticas
Arquivos a modificar:

assets/js/dashboard.js - Função para enviar emails
Integração com backend (API endpoint ou Supabase Function)
Tarefas:

Botão "Enviar resposta" no modal do candidato
Selecionar template e personalizar
Enviar email via backend (já deve ter endpoint)
Histórico de emails enviados
Status de entrega (enviado, falhou)
Notificação de sucesso/erro
4.3 Envio Automático por Status
Arquivos a modificar:

assets/js/dashboard.js - Lógica de envio automático
Tarefas:

Configuração: ativar/desativar envio automático
Ao mover candidato para "Contratado" → enviar email de aprovação
Ao mover para "Rejeitado" (nova coluna?) → enviar email de rejeição
Logs de emails enviados automaticamente
Fase 5: Métricas e Relatórios (Prioridade BAIXA)
5.1 Dashboard com Gráficos
Arquivos a modificar:

index.html - Adicionar seção de gráficos
assets/js/dashboard.js - Funções para calcular métricas e renderizar gráficos
Adicionar biblioteca de gráficos (Chart.js)
Tarefas:

Gráfico de pizza: distribuição de candidatos por status
Gráfico de barras: candidatos por vaga
Gráfico de linha: evolução de candidatos ao longo do tempo
Taxa de conversão real (calcular: contratados / total aplicados)
Tempo médio em cada etapa do pipeline
Taxa de contratação por vaga
5.2 Exportação de Dados
Arquivos a modificar:

assets/js/dashboard.js - Funções de exportação
Tarefas:

Exportar lista de candidatos para CSV/Excel
Exportar relatório de vagas
Exportar pipeline completo
Gerar PDF de relatório mensal
Fase 6: Melhorias de UX e Performance (Prioridade BAIXA)
6.1 Notificações em Tempo Real
Arquivos a modificar:

assets/js/dashboard.js - Integrar Supabase Realtime
Tarefas:

Usar Supabase Realtime para atualizações automáticas
Notificar quando novo candidato é adicionado
Notificar quando entrevista é agendada
Badge de notificações não lidas
6.2 Responsividade Mobile
Arquivos a modificar:

css/style.css - Media queries
Todas as páginas HTML
Tarefas:

Sidebar colapsável em mobile
Pipeline com scroll horizontal otimizado
Tabelas responsivas (cards em mobile)
Touch gestures para drag-and-drop
6.3 Performance
Arquivos a modificar:

assets/js/dashboard.js - Otimizações
Tarefas:

Paginação nas listas (limitar a 50 itens por vez)
Lazy loading de imagens de currículos
Debounce em buscas
Cache de dados frequentes
Estrutura de Dados Esperada no Supabase
Assumindo que o backend já está configurado, o frontend espera estas tabelas/colunas:

Tabela candidatos:

id, nome, email, Endereco, nota, vaga_sugerida
status ou etapa_processo (para pipeline)
curriculo_url (URL do arquivo do currículo)
data_cadastro, telefone (se disponível)
Tabela Vagas:

id, Titulo, Descricao, Requisitos
status_vagas, data_abertura, data_encerramento
AdminID
Tabela Entrevistas:

id, Data, Status, Entrevistador, Observações
Relacionamento com candidatos e Vagas
Ordem de Implementação Recomendada
Sprint 1 (2 semanas): Fase 1 completa (Pipeline funcional)
Sprint 2 (2 semanas): Fase 2.1 e 2.2 (Detalhes e visualização de currículos)
Sprint 3 (1-2 semanas): Fase 2.3 (Busca e filtros)
Sprint 4 (2 semanas): Fase 3 (Sistema de entrevistas)
Sprint 5 (2 semanas): Fase 4 (Respostas automáticas)
Sprint 6+ (contínuo): Fases 5 e 6 (Métricas e melhorias)
Notas Técnicas
Usar Supabase Client já configurado em assets/js/supabaseClient.js
Manter consistência visual com o design atual (dark theme)
Todas as operações devem ter tratamento de erros
Adicionar loading states em todas as operações assíncronas
Validar dados antes de enviar para o Supabase