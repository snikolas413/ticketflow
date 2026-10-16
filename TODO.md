# TODO — TicketFlow

> **Status atual:** vertical slice ampliada com catálogo profissional, usuários vinculados a setor/equipe, aprovação por área, autoatribuição de analistas, notificações, anexos duráveis, perfil gestor com escopo, auditoria operacional e login local. `pnpm check`, `pnpm test` (8 testes) e `pnpm build` passaram; migration `0008_wealthy_saracen.sql` gerada/aplicada.

## Entrega 1 — Fundação funcional de tickets

### Autenticação e contexto do usuário

- [x] Usar login local por e-mail corporativo e senha como autenticação pública da aplicação; manter compatibilidade OAuth apenas no backend durante a migração.

- [x] Manter a sessão no cookie `webdev_app_session`, validando JWT, `appId`, expiração e identidade do usuário no servidor.

- [x] Criar estado de usuário autenticado e deslogado no frontend sem usuário simulado permanente.

- [x] Permitir logout e preservar o retorno para uma rota fixa da aplicação.

### Organização, papéis e permissões

- [x] Persistir departamentos, equipes e filas de atendimento.

- [x] Persistir papéis e permissões configuráveis.

- [x] Permitir que administradores criem setores/departamentos pela interface.

- [x] Permitir que administradores criem tipos de chamado com descrição e fila padrão.

- [x] Disponibilizar menu `/admin` dedicado com setores, tipos, categorias, serviços, usuários e índice de anexos.

- [x] Promover o primeiro usuário autenticado a administrador total somente quando não houver administrador; bloquear autoelevação posterior.

- [x] Permitir ao administrador cadastrar usuários por e-mail corporativo e atribuir os perfis solicitante, atendente ou aprovador.

- [x] Aplicar perfis cumulativos: atendente também solicita; aprovador também solicita e atende.

- [x] Restringir novos logins, após o bootstrap inicial, a e-mails corporativos autorizados pelo administrador.

- [x] Persistir notificações de chamados abertos, chamados atribuídos e aprovações.

- [x] Implementar solicitação, aprovação e rejeição de solicitações com histórico de decisão.

- [x] Criar aprovação inicial automaticamente ao abrir chamado para um aprovador ativo da mesma área responsável; manter o chamado pendente quando não houver aprovador elegível.

- [x] Exibir na fila do aprovador da área os chamados pendentes e manter o acesso do solicitante ao ticket relacionado.

- [x] Após decisão, notificar solicitante, responsável atribuído e usuário que solicitou a aprovação.

- [x] Roteiar a abertura do chamado pelo setor e tipo escolhidos, resolvendo equipe/fila no servidor.

- [x] Persistir no usuário o nível operacional, setor e equipe; exigir setor para atendentes, aprovadores e gestores.

- [x] Impedir que atendentes visualizem ou operem chamados pendentes de validação; após aprovação, permitir autoatribuição atômica somente para usuários operacionais da mesma área.

- [x] Permitir o perfil adicional de gestor com escopo por setor/equipe; administrador, atendente, solicitante e aprovador continuam disponíveis.

- [x] Restringir no servidor a leitura, detalhe, comentários internos, anexos, transições e atribuições do gestor aos setores/equipes autorizados.

- [x] Permitir ao administrador substituir os escopos de um gestor no menu `/admin`, com validação de pertencimento entre equipe e setor.

- [x] Manter gestor sem escopo limitado aos chamados próprios ou atribuídos, sem acesso amplo implícito.

- [x] Permitir ao administrador criar equipes vinculadas a setores ativos.

- [x] Disponibilizar login local por e-mail corporativo e senha com hash server-side, sem acesso Manus na interface pública.

- [x] Bloquear login local para contas inexistentes, inativas ou sem senha definida, sem revelar qual credencial falhou.

- [x] Considerar o escopo do usuário ao autorizar leitura e operação de tickets; a primeira slice usa solicitante, responsável e administrador.

- [x] Verificar autorização no servidor para cada operação; esconder um botão no frontend não substitui a autorização.

### Criação e gestão inicial de tickets

- [x] Cada ticket deve possuir número único e identificador público legível.

- [x] Persistir título, descrição, solicitante, departamento, equipe, fila, prioridade, status, responsável e datas de abertura/atualização.

- [x] Permitir criação de ticket por solicitante autenticado.

- [x] Exibir lista com busca, filtros básicos, ordenação e estados de carregamento, ausência de dados e erro.

- [x] Exibir detalhe do ticket com resumo operacional, histórico e próximos estados permitidos.

- [x] Implementar atribuição server-side para administradores/gestores e autoatribuição atômica para analistas da área após validação.

- [x] Impedir acesso a tickets fora do escopo autorizado.

- [x] Permitir anexar até 5 arquivos de até 10 MB na abertura, com metadados persistidos em banco e bytes no storage durável Manus.

- [x] Permitir anexar arquivos em respostas do atendente e disponibilizar download autorizado pelo servidor.

- [x] Ocultar anexos vinculados a notas internas para usuários sem permissão operacional.

### Comentários, notas internas e histórico

- [x] Permitir comentários públicos visíveis ao solicitante.

- [x] Permitir notas internas visíveis apenas a usuários autorizados.

- [x] Registrar criação, atribuição, alteração de status e comentários em histórico cronológico.

- [x] Preservar timestamps e ator de cada evento.

### Transições de status

- [x] Implementar status iniciais coerentes para o primeiro fluxo: Aberto, Em atendimento, Aguardando solicitante, Resolvido e Encerrado.

- [x] Permitir somente transições válidas definidas pelo servidor.

- [x] Registrar tentativas inválidas, acessos fora do escopo e transições negadas em tabela de auditoria dedicada, sem alterar o ticket.

- [x] Aceitar comentário opcional na transição; regras obrigatórias por workflow ficam para a fase configurável.

### Assistência de IA Manus

- [x] Criar adaptador server-side para o endpoint Manus LLM usando as variáveis fornecidas pelo ambiente.

- [x] Restringir o contexto enviado à IA ao que o usuário autenticado pode acessar.

- [x] Registrar solicitações de assistência e resultado sem expor credenciais no navegador.

- [x] Implementar sugestões controladas de resumo do histórico e resposta.

- [x] Exibir a saída como sugestão revisável; não alterar status, aprovação ou comunicação externa automaticamente.

- [x] Mostrar mensagem de indisponibilidade quando a chamada de IA falhar.

### Qualidade e operação

- [x] Criar migration aditiva e reproduzível para as tabelas do incremento.

- [ ] Adicionar testes de procedures e autorização negativa com harness de integração autenticado; as procedures já registram transições inválidas e acessos negados em auditoria server-side.

- [ ] Adicionar testes do fluxo principal de criação e atualização de tickets; depende de harness de integração autenticado.

- [x] Rodar `pnpm check`, `pnpm test` e `pnpm build` sem falhas.

- [x] Servir `/manus-routes.json` com todas as rotas de página atuais.

- [x] Documentar variáveis de ambiente, migration, execução, limitações e próximos passos.

- [x] Atualizar o checkpoint da fase de catálogo somente com os arquivos intencionais no repositório canônico; commit `099bf1e` enviado para `main`.

- [x] Atualizar o checkpoint da fase de perfil gestor somente com os arquivos intencionais no repositório canônico; commit `303a687` enviado para `main`.

- [x] Atualizar o checkpoint final de auditoria operacional somente com os arquivos intencionais no repositório canônico; commit `014b76e` enviado para `main`.

- [x] Atualizar o checkpoint de login corporativo, equipes e operação por destino; commit `a822d06` enviado para `main`.

- [x] Atualizar o checkpoint da correção da cadeia de aprovação; commit `dde0323` enviado para `main`.

- [x] Remover o acesso Manus da interface pública de login; commit `73fcae3` enviado para `main`.

- [x] Simplificar o login para e-mail e senha locais, com primeiro acesso que cria a conta administradora quando não há conta local.

- [x] Aceitar contas legadas ou inseridas manualmente com `passwordHash`; senha temporária é convertida para hash no primeiro login e `openId` vazio recebe identidade local automaticamente.

- [x] Reorganizar o menu administrativo em abas de **Estrutura**, **Catálogo**, **Pessoas e acessos** e **Operação**, com resumo de indicadores, formulários guiados, instruções contextuais e listas separadas por tarefa.

- [x] Corrigir a criação de usuários: o cadastro administrativo grava imediatamente a conta local em `users`, com senha hash, perfil, setor/equipe e acesso pronto para login; a conta passa a aparecer na listagem sem aguardar o primeiro acesso.

## Próximas entregas

- [x] Catálogo de serviços e categorias hierárquicas configuráveis.

- [x] Permitir categorias pai/filho com código, descrição, ordenação e estado ativo/inativo.

- [x] Permitir serviços vinculados a uma categoria, com tipo de chamado padrão e fila padrão.

- [x] Validar no servidor que setor, categoria, serviço, tipo e fila selecionados são ativos e coerentes.

- [x] Exibir categoria e serviço na abertura, lista e detalhe do chamado sem quebrar tickets existentes.

- [x] Implementar o perfil gestor com escopo por setor/equipe.

- [x] Implementar equipes subordinadas aos setores e tela de login corporativo local.

- [x] Auditoria operacional de acessos negados e transições inválidas.

- [ ] Construtor de formulários dinâmicos versionados.

- [ ] Construtor de workflows e editor de transições.

- [ ] Motor de regras com outbox, idempotência, retries e auditoria.

- [ ] Aprovações, alçadas e segregação de funções.

- [ ] SLAs, calendários, pausas e escalonamentos.

- [x] Notificações internas persistidas e exibidas no sino global.

- [ ] Integração de notificações por e-mail externo.

- [ ] Dashboards, indicadores, relatórios e exportação.
