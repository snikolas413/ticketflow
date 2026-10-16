# TicketFlow

Plataforma configurável de gestão de tickets e workflows, em português brasileiro.

## Escopo entregue nesta versão

A primeira vertical slice implementa login local, shell operacional, organização inicial com setores/departamentos, equipes/filas, catálogo de tipos de chamado, categorias e serviços hierárquicos, persistência relacional de tickets, comentários públicos, notas internas para administradores, histórico, transições básicas de status, anexos duráveis e assistência de IA revisável no detalhe do ticket.

Os dados de tickets são persistidos no banco gerenciado via Drizzle. A configuração inicial de Operações, Atendimento geral, Fila principal e tipos Incidente/Requisição/Problema é criada apenas quando ainda não existe uma configuração. Administradores podem criar setores e tipos pela interface; o servidor resolve a equipe/fila da abertura.

## Execução local do projeto

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

O servidor usa a porta `3000` por padrão e escuta em `0.0.0.0`. Os comandos principais são:

```bash
pnpm check       # verificação TypeScript
pnpm test        # testes automatizados
pnpm build       # build de frontend e backend
pnpm db:migrate  # aplica migrations já geradas
pnpm db:push     # gera e aplica uma migration após alteração intencional do schema
```

## Publicação no Render com Supabase

O blueprint `render.yaml` cria o serviço web a partir do Dockerfile. Crie um projeto PostgreSQL no Supabase e configure `DATABASE_URL` no Render com a URL do **Session pooler** do Supabase; não use a senha diretamente no repositório. Antes do primeiro uso, aplique o schema PostgreSQL novo a partir da raiz do projeto:

```powershell
$env:DATABASE_URL = "<URL do Session pooler do Supabase>"
pnpm db:migrate
```

As migrations PostgreSQL ficam em `drizzle-supabase/`; as migrations antigas em `drizzle/` continuam sendo o histórico MySQL e não devem ser aplicadas ao Supabase. O blueprint gera `MANUS_JWT_SECRET` e define `MANUS_PROJECT_ID` para assinar sessões locais. Para habilitar anexos e assistência de IA, configure também `MANUS_API_URL` e `MANUS_API_KEY` como secrets no Render; sem essas variáveis, o servidor sobe, mas essas integrações não funcionam.

## Variáveis de ambiente

O ambiente Webdev gerenciado fornece as variáveis de plataforma em desenvolvimento e publicação. As principais utilizadas são:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão MySQL gerenciada para Drizzle |
| `MANUS_PROJECT_ID` | Identificador público do projeto OAuth |
| `MANUS_OAUTH_PORTAL_URL` | Portal de autorização Manus |
| `MANUS_OAUTH_API_URL` | Troca de código e consulta de identidade |
| `MANUS_JWT_SECRET` | Validação das sessões da aplicação |
| `MANUS_API_URL` | API de serviços Manus |
| `MANUS_API_KEY` | Credencial server-side para LLM Manus |
| `OWNER_OPEN_ID` | Opcional; identifica o proprietário para papel administrativo inicial |
| `PORT` | Porta do processo; padrão `3000` |

Não coloque valores reais dessas variáveis no repositório ou no frontend.

## Migrations

A migration `drizzle/0001_jazzy_the_liberteens.sql` adiciona as tabelas de departamentos, equipes, filas, papéis, permissões, tipos de ticket, tickets, comentários, eventos e solicitações de assistência de IA. A migration `drizzle/0002_bouncy_talon.sql` adiciona metadados de anexos. A migration `drizzle/0004_silky_scarlet_witch.sql` adiciona categorias, serviços e os vínculos opcionais no ticket. A migration `drizzle/0005_clammy_master_chief.sql` adiciona o perfil gestor, escopos por setor/equipe e equipe opcional no convite corporativo. A migration `drizzle/0006_natural_triathlon.sql` adiciona a auditoria persistida de tentativas negadas e transições inválidas. A migration `drizzle/0007_overrated_thor.sql` adiciona hash de senha local nas contas e convites. Os bytes são enviados para o storage durável Manus; o banco guarda chave, nome, tipo, tamanho e vínculo ao ticket/comentário.

O banco gerenciado é compartilhado entre desenvolvimento e publicação. Evite comandos destrutivos e revise migrations antes de aplicá-las. A migration `drizzle/0008_wealthy_saracen.sql` adiciona setor/equipe ao usuário, estado persistente de validação do ticket e índice de roteamento.

## Rotas de página

- `/` — painel de operações e criação de chamados.
- `/tickets/:id` — detalhe, atividade, comentários, transições e assistência de IA.
- `/admin` — administração dedicada de setores, tipos, categorias, serviços, usuários e índice de anexos.
- `/login` — entrada por e-mail corporativo e senha local.
- `/api/health` — health check não autenticado.
- `/manus-routes.json` — manifesto das rotas de página.

## Segurança e autorização

A aplicação usa sessão local por e-mail e senha; o backend valida a identidade e as permissões antes de acessar tickets. Usuários comuns veem somente chamados próprios ou pertinentes à sua área e perfil; administradores têm acesso operacional ampliado. Notas internas exigem perfil operacional, gestor ou administrador.

Quando não existe nenhum administrador cadastrado, o primeiro usuário autenticado é promovido uma única vez ao perfil de administrador total da aplicação. Depois que um administrador existe, nenhum usuário comum consegue se autoelevar. O ambiente também pode definir `OWNER_OPEN_ID` para promover explicitamente a conta proprietária.

## Usuários, perfis e notificações

Na área `/admin`, o administrador encontra quatro áreas de trabalho: **Estrutura** para setores e equipes, **Catálogo** para tipos, categorias e serviços, **Pessoas e acessos** para usuários, perfis e escopos, e **Operação** para anexos e auditoria. Indicadores no topo mostram a quantidade de setores, equipes, usuários e categorias. Os formulários são separados por objetivo e trazem instruções contextuais para reduzir erros de configuração. Ao criar um usuário, a conta é gravada imediatamente em `users` com senha `scrypt`, perfil, setor/equipe e login local pronto; ela já aparece na listagem e pode autenticar sem depender de um primeiro registro OAuth. O administrador cadastra o e-mail corporativo, escolhe um perfil e vincula o usuário a um setor/equipe. Os perfis são cumulativos: o solicitante abre chamados e acompanha retornos; o atendente também pode abrir chamados, responder, anexar arquivos e operar chamados aprovados da própria área; o aprovador acumula essas funções e valida os chamados da sua área; o gestor pode operar, atribuir e consultar chamados dentro dos setores/equipes autorizados. Atendentes, aprovadores e gestores precisam de setor para que o roteamento seja determinístico. Após o primeiro administrador existir, um novo login só é aceito quando o e-mail corporativo estiver autorizado no catálogo administrativo.

O login local usa e-mail corporativo normalizado, senha com hash `scrypt`, sessão curta renovável e bloqueio de contas inativas. A interface pública não oferece mais botão ou fluxo de acesso Manus; o endpoint OAuth legado permanece apenas no backend para compatibilidade operacional durante a migração. Senhas nunca são persistidas em texto puro nem retornadas ao frontend.

Se o banco ainda não tiver uma conta local com senha, `/login` exibe **Primeiro acesso: criar administrador**. Esse fluxo cria a primeira conta diretamente no banco e já inicia a sessão. Se já existir uma conta legada com o mesmo e-mail, o primeiro acesso define a senha local nela. Para inserções manuais, a coluna usada é `passwordHash`; o backend também converte uma senha temporária inserida nessa coluna para hash scrypt no primeiro login. O campo `openId` pode ficar vazio em uma conta manual: ele é preenchido automaticamente como identidade local após a autenticação.

O administrador define os escopos do gestor no bloco **Escopo dos gestores**. Um escopo de setor inclui suas equipes; um escopo de equipe é mais restrito. O servidor aplica o filtro também no detalhe, comentários internos, anexos, transições e atribuições. Sem escopos, o gestor vê somente chamados próprios ou atribuídos, evitando acesso implícito amplo.

Setores podem possuir várias equipes, criadas pelo administrador no próprio catálogo. A equipe é sempre vinculada a um setor ativo. O servidor usa setor/equipe do usuário para rotear aprovação e atendimento, impedindo acesso fora da área autorizada.

O bloco **Auditoria operacional** mostra os eventos recentes de acesso negado, tentativa de transição não permitida e transição inválida. Esses registros são gravados pelo servidor com ator, chamado, ação, recurso, payload e timestamp; não dependem da interface para existir.

O sistema possui notificações internas para chamado aberto, chamado atribuído, aprovação solicitada e decisão de aprovação. Elas aparecem no sino global e são persistidas no banco. Notificações por e-mail externo ainda não estão habilitadas nesta fase.

Ao abrir um chamado, o servidor mantém o ticket com validação pendente, cria uma aprovação inicial para um aprovador ativo da área responsável e notifica esse usuário. O solicitante acompanha o ticket desde a abertura; o aprovador da área visualiza e decide a validação. Enquanto pendente, atendentes não visualizam nem operam o chamado. Após a aprovação, analistas elegíveis da mesma área podem clicar em **Assumir chamado**; a operação é atômica e o primeiro a assumir torna-se responsável, iniciando o atendimento. Após a decisão, o solicitante, o solicitante da aprovação e o responsável atribuído recebem a notificação de resultado.

A assistência de IA é chamada somente no servidor, usa o contexto autorizado do ticket e registra a solicitação no banco. A saída é uma sugestão revisável: ela não altera automaticamente status, aprovações ou mensagens externas.

Anexos são validados no servidor: até 5 arquivos por abertura/resposta, com limite de 10 MB por arquivo. O atendente e o solicitante autorizado baixam arquivos por URL temporária assinada; anexos vinculados a notas internas ficam fora do escopo de usuários sem permissão operacional.

## Limitações conhecidas

O construtor visual de formulários, workflows livres, motor de regras, SLA, aprovações em alçada, notificações de e-mail e dashboards gerenciais ainda estão planejados para as próximas fases. A aplicação usa categorias e serviços hierárquicos nesta fase, preservando tickets antigos sem essa classificação.

A homologação autenticada completa depende do login OAuth no Preview. Os testes automatizados atuais cobrem autenticação existente, integração de plataforma e transições do workflow inicial; `pnpm check`, `pnpm test` e `pnpm build` estão verdes.
