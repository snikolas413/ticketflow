# Plano de implementação — TicketFlow

## Contexto e escopo aprovado

Implementar a primeira entrega funcional da plataforma configurável de gestão de tickets especificada pelo usuário. A entrega inicial prioriza uma fundação real de ponta a ponta: autenticação Manus OAuth, usuários, perfis e permissões, setores/departamentos, equipes/filas, catálogo de tipos de chamado, criação e consulta de tickets, comentários públicos e notas internas, anexos duráveis, atribuição, transições básicas e histórico. O sistema usará o backend Express/tRPC e o banco MySQL gerenciado já selecionados no projeto.

A arquitetura permanecerá preparada para as próximas fases: formulários dinâmicos versionados, workflows configuráveis, motor de regras, aprovações, SLA, notificações, relatórios e assistência de IA integrada ao Manus.

## Abordagem de implementação

- Preservar o starter React/Express/tRPC/Drizzle e evoluir a estrutura em módulos.
- Usar as tabelas existentes de usuários e adicionar tabelas relacionais para organização, permissões, catálogo, tickets e anexos.
- Validar autorização e integridade no servidor; o frontend não será fonte de verdade.
- Manter eventos e histórico como registros append-only.
- Usar tRPC para operações de produto e endpoints HTTP apenas para health, OAuth e APIs de plataforma.
- Usar o storage durável Manus por presigned upload server-side, sem colocar chaves no navegador.
- Modelar o chamado com o vocabulário operacional profissional: setor solicitante, tipo, equipe/fila, prioridade, responsável, status, histórico e arquivos.
- Entregar uma vertical slice real antes de iniciar os construtores administrativos.

## Arquitetura e módulos

```text
client/src/
  components/        componentes visuais reutilizáveis
  pages/             Dashboard, Tickets e Detalhe do ticket
  lib/               cliente tRPC e utilidades
server/
  _core/             autenticação Manus, contexto e infraestrutura
  db.ts              queries e transações de persistência
  routers.ts         contratos tRPC e autorização de entrada
  ai.ts              adaptador Manus LLM para assistência futura
  services/          casos de uso e regras de domínio
shared/
  const.ts           contratos compartilhados
  ticket-types.ts    tipos, status e prioridades
  validation.ts      schemas de entrada
 drizzle/
  schema.ts          modelo relacional Drizzle
  migrations/        mudanças versionadas
public/
  manus-routes.json  manifesto de rotas da aplicação
```

## Persistência

O banco gerenciado é MySQL compatível. A migration inicial manterá a tabela `users` existente e adicionará:

- `departments`, `teams`, `queues`;
- `roles`, `permissions`, `userRoles`, `rolePermissions`;
- `ticketTypes`, `tickets`, `ticketComments`, `ticketEvents`;
- `ticketAttachments`, com metadados, vínculo ao comentário e chave de storage durável;
- índices para filas, status, solicitante e responsável.

As entidades de formulário, workflow, regra, aprovação, SLA e notificação entrarão em migrations próprias quando suas funcionalidades forem implementadas. Tickets preservarão o status e o tipo usados no momento da criação.

## Design

### Movimento visual

**Editorial operacional / painel de comando humano.** A interface combina a clareza de uma central de operações com a hierarquia de uma publicação editorial: informação densa, mas respirável, com decisões importantes destacadas sem transformar tudo em cartões genéricos.

### Princípios

1. **Sinal antes do ruído:** status, SLA e próxima ação são mais importantes que decoração.
2. **Densidade legível:** tabelas e listas compactas, com alinhamento e espaçamento previsíveis.
3. **Confiança operacional:** ações destrutivas ou de mudança de estado são explícitas e auditáveis.
4. **Configuração gradual:** interfaces complexas aparecem em camadas, não todas de uma vez.

### Filosofia de cor

A base é azul-marinho quase preto e off-white quente, transmitindo estabilidade e foco. O azul-cobalto é a cor proprietária de ação e navegação. Verde menta sinaliza progresso e resolução; âmbar indica atenção e SLA; coral fica reservado para bloqueios e falhas. Cores de estado devem sempre aparecer com texto ou ícone, nunca isoladas.

### Paradigma de layout

Navegação lateral fixa e estreita, com uma coluna de contexto que muda conforme a área. O conteúdo principal usa uma faixa de título com contexto e uma área de trabalho ampla; detalhes de ticket podem abrir em layout de duas colunas com atividade à esquerda e resumo operacional à direita. Evitar dashboards compostos somente de cards centralizados.

### Elementos de assinatura

- Marca TicketFlow composta por um símbolo de trilha com dois nós conectados, remetendo a ticket e workflow.
- Barras de status finas e etiquetas com bordas suaves para leitura rápida.
- Cabeçalhos editoriais com kicker em caixa alta, número monoespacial e título forte.

### Interação

Cada tela deve responder claramente a três perguntas: onde estou, o que exige atenção e qual é a próxima ação. Ações de transição devem explicar o resultado. Formulários devem preservar entradas em falhas e exibir mensagens próximas ao campo.

### Animação

Usar transições discretas de 150–220 ms para abertura de painéis, atualização de status e toast. Evitar animação contínua. O carregamento usa skeletons alinhados ao conteúdo; sucesso de transição pode usar um breve highlight na linha do ticket. Respeitar `prefers-reduced-motion`.

### Tipografia

Usar `Inter` para texto de interface e `IBM Plex Mono` para números de ticket, IDs, SLAs e metadados técnicos. Hierarquia: títulos 28–36 px, títulos de seção 16–20 px, texto 14–15 px, metadados 12–13 px. O título deve ser forte sem ocupar o espaço da informação operacional.

### Essência da marca

**A central configurável que transforma solicitações dispersas em trabalho rastreável.**

Personalidade: **precisa, confiável, habilitadora**.

### Voz

Headlines e CTAs devem ser diretos, calmos e orientados à ação. Microcopy deve explicar consequência e não culpar o usuário.

- “O que precisa de atenção hoje”
- “Envie para a próxima etapa”

### Wordmark e logo

O wordmark usa “Ticket” em peso semibold e “Flow” em peso regular, acompanhado do símbolo de trilha com dois nós. O símbolo deverá funcionar sozinho em avatar/favicone e em uma versão horizontal no shell.

### Cor de marca

**Azul Cobalto Operacional — `#3157D5`**, usado em navegação, links de ação e estados selecionados.

## Fluxo de build e validação

1. Implementar schema e migration aditiva.
2. Implementar queries e casos de uso no servidor.
3. Expor procedures tRPC protegidas e testar autorização negativa.
4. Implementar shell e telas com estados de carregamento, vazio e erro.
5. Adicionar `public/manus-routes.json` antes de iniciar o servidor.
6. Rodar `pnpm check`, `pnpm test` e `pnpm build`.
7. Iniciar `pnpm dev` na porta configurada e verificar `/api/health` e `/manus-routes.json`.
8. Inspecionar a interface no Preview apenas se necessário para corrigir defeitos concretos.
9. Atualizar TODO com evidências.
10. Criar commit e checkpoint no repositório canônico, sem publicar automaticamente.

## Limitações explícitas da primeira entrega

- O primeiro incremento não implementa ainda o construtor visual de formulários, workflow livre, motor de regras, SLA completo, aprovações, e-mail, categorias hierárquicas ou automações avançadas.
- A assistência de IA será integrada por adaptador e endpoint controlado; nenhuma sugestão será aplicada automaticamente a decisões críticas.
- O login usa Manus OAuth conforme o padrão do projeto; não será criada autenticação local paralela.
- Dados de demonstração, se usados para facilitar a visualização, serão identificados na interface e não substituirão persistência real.

## Próxima fase aprovada — catálogo profissional

A próxima entrega evolui o catálogo atual para uma árvore configurável de **categorias** e **serviços**, mantendo setor, tipo e fila como dimensões operacionais. Categorias terão relação pai/filho, código, descrição, ativo/inativo e ordenação; serviços pertencerão a uma categoria, terão descrição, tipo padrão e fila padrão, e poderão ser escolhidos na abertura do chamado. O servidor validará que categoria, serviço, setor, tipo e fila pertencem a registros ativos e coerentes, evitando referências cruzadas indevidas.

O detalhe e a lista do ticket exibirão o serviço e a categoria selecionados. A administração ganhará criação e visualização hierárquica do catálogo, com estados vazios e feedback de validação. A migration será aditiva e a implementação preservará tickets existentes usando campos opcionais para a nova taxonomia.

Depois desta fase, a ordem recomendada é: perfil gestor com escopo por setor/equipe, testes de autorização negativa e integração, construtor de formulários dinâmicos versionados, workflows configuráveis e então SLA/notificações externas.

## Fechamento operacional — equipes e login local

Setores podem cadastrar equipes subordinadas, sempre validadas no servidor contra um setor ativo. Usuários e gestores devem ser encaminhados apenas para chamados próprios, atribuídos ou pertencentes ao escopo explícito; o frontend não é a fronteira de segurança. A tela de login usa e-mail corporativo e senha local com hash `scrypt`, mantendo o cookie de sessão existente e o OAuth como recuperação durante a migração.

## Entrega seguinte — perfil gestor com escopo

O perfil `manager` será cumulativo com a operação: pode consultar, responder, anexar, alterar status, solicitar aprovação e atribuir chamados, mas somente quando o ticket estiver em um escopo persistido para seu usuário. A tabela `managerScopes` aceita escopo por setor ou por equipe; equipe sempre deve pertencer ao setor informado. O administrador substitui a lista de escopos de forma atômica na tela `/admin`. Convites corporativos podem carregar setor/equipe opcional e o primeiro login de um gestor materializa esse escopo.

O filtro server-side combina chamados próprios/atribuídos com os escopos do gestor. O mesmo predicado é reaplicado no detalhe e nas operações sensíveis: comentários internos, anexos, transições e atribuições. O frontend apenas apresenta o painel e controles correspondentes; a autorização efetiva permanece no backend. Gestores sem escopo não recebem acesso amplo por padrão.
