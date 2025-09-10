# Oracle Query Tool - Web DB

Uma ferramenta web completa para conectar, consultar e gerenciar bancos de dados Oracle através de uma interface moderna e intuitiva.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Como Usar](#-como-usar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [API Endpoints](#-api-endpoints)
- [Segurança](#-segurança)
- [Troubleshooting](#-troubleshooting)
- [Contribuição](#-contribuição)

## 🎯 Visão Geral

O Oracle Query Tool é uma aplicação web que permite aos usuários:
- Conectar-se a bancos de dados Oracle remotamente
- Executar consultas SQL com editor Monaco integrado
- Visualizar estruturas de tabelas e schemas
- Exportar resultados para Excel
- Navegar facilmente entre tabelas e dados

## ✨ Funcionalidades

### 🔗 Conexão com Oracle
- Suporte a múltiplos formatos de connection string
- Diagnóstico automático de problemas de conectividade
- Teste de ping para verificar alcance do servidor
- Reconexão automática em caso de falha

### 📝 Editor SQL Avançado
- Editor Monaco com syntax highlighting para SQL
- Autocompletar e validação de sintaxe
- Histórico de consultas
- Conversão automática de formatos de data

### 📊 Visualização de Dados
- Tabelas responsivas com scroll infinito
- Busca e filtro em tempo real
- Informações detalhadas de colunas (tipo, tamanho, precision)
- Contagem automática de registros

### 📤 Exportação
- Export para Excel (.xlsx)
- Preservação de tipos de dados
- Metadados inclusos

### 🔍 Exploração de Schema
- Listagem de todas as tabelas acessíveis
- Visualização de estrutura de tabelas (DESCRIBE)
- Busca por nome de tabela/schema
- Preview rápido de dados (100 primeiras linhas)

## 📋 Pré-requisitos

### Software Necessário
- **Node.js** 14.17+ 
- **npm** ou **yarn**
- **Oracle Database** (11g+, 12c, 19c, 21c)
- **Oracle Client Libraries** (Instant Client)

### Configuração do Oracle Client
```bash
# Download Oracle Instant Client
# Windows: https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html
# Linux: https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
# macOS: https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html

# Configurar variáveis de ambiente (Linux/macOS)
export LD_LIBRARY_PATH=/path/to/instantclient:$LD_LIBRARY_PATH

# Windows
# Adicionar o diretório do Instant Client ao PATH
```

## 🚀 Instalação

### 1. Clone o repositório
```bash
git clone <repository-url>
cd oracle-query-tool-backend
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Execute a aplicação
```bash
# Desenvolvimento (com nodemon)
npm run dev

# Produção
npm start
```

### 4. Acesse a aplicação
Abra seu navegador e acesse: `http://localhost:3000`

O navegador será aberto automaticamente após o início do servidor.

## ⚙️ Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (opcional):

```env
PORT=3000
ORACLE_CLIENT_PATH=/path/to/instant_client
```

### Configurações de Conexão Oracle
A aplicação suporta múltiplos formatos:

1. **Service Name**: `hostname:port/service_name`
2. **SID**: `hostname:port:sid`
3. **TNS Completo**: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=hostname)(PORT=port))(CONNECT_DATA=(SERVICE_NAME=service_name)))`

## 📖 Como Usar

### 1. Primeira Conexão

1. Clique em **"Abrir Conexão"**
2. Preencha os dados do servidor:
   - **Hostname/IP**: Endereço do servidor Oracle
   - **Porta**: Geralmente 1521
   - **Service Name/SID**: Nome do serviço ou SID
   - **Usuário**: Nome de usuário do banco
   - **Senha**: Senha do usuário
3. Clique em **"Conectar"**

### 2. Explorando Tabelas

- Use a **barra de busca** para filtrar tabelas
- **Clique em uma tabela** para gerar automaticamente `SELECT * FROM tabela LIMIT 100`
- **Clique em "Detalhes"** para ver a estrutura da tabela

### 3. Executando Consultas

1. Digite ou cole sua consulta SQL no editor
2. Clique em **"▶️ Executar"**
3. Visualize os resultados na tabela abaixo
4. Use **"📥 Exportar"** para baixar os dados

### 4. Recursos Avançados

#### Conversão Automática de Datas
O sistema converte automaticamente datas no formato `'DD-MM-YY'` ou `'DD-MM-YYYY'` para `TO_DATE()`:
```sql
-- Entrada
SELECT * FROM tabela WHERE data_campo = '25-12-2023'

-- Conversão automática
SELECT * FROM tabela WHERE data_campo = TO_DATE('25-12-2023','DD-MM-YYYY')
```

#### Limitação Inteligente
Quando você usa `ROWNUM`, `ROW_NUMBER()`, `OFFSET/FETCH`, o sistema desativa paginação automática.

## 📁 Estrutura do Projeto

```
oracle-query-tool-backend/
├── package.json          # Dependências e scripts
├── package-lock.json     # Lock das dependências
├── server.js             # Servidor Express principal
├── index.html            # Interface web
└── README.md             # Este arquivo
```

### Dependências Principais
- **express**: Framework web
- **cors**: Cross-origin resource sharing
- **oracledb**: Driver oficial Oracle para Node.js
- **nodemon**: Auto-reload em desenvolvimento

## 🔌 API Endpoints

### Conexão
- `POST /api/connect` - Estabelecer conexão
- `POST /api/disconnect` - Fechar conexão
- `GET /api/status` - Status da conexão

### Consultas
- `POST /api/execute` - Executar SQL
- `GET /api/tables` - Listar tabelas
- `POST /api/describe` - Descrever estrutura da tabela

### Diagnóstico
- `POST /api/diagnose` - Testar conectividade de rede

### Exemplo de uso da API:

```javascript
// Conectar
const response = await fetch('/api/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    hostname: '192.168.1.100',
    port: 1521,
    serviceName: 'ORCL',
    username: 'user',
    password: 'pass'
  })
});

// Executar consulta
const queryResponse = await fetch('/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'SELECT * FROM dual',
    page: 1,
    pageSize: 100
  })
});
```

## 🔒 Segurança

### ⚠️ AVISOS IMPORTANTES

Esta ferramenta foi desenvolvida para **ambientes de desenvolvimento e teste**. Para uso em produção, implemente as seguintes medidas:

### Autenticação e Autorização
```javascript
// Adicionar middleware de autenticação
app.use('/api', authMiddleware);

function authMiddleware(req, res, next) {
  // Implementar verificação de token/sessão
  const token = req.headers.authorization;
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

### HTTPS
```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem')
};

https.createServer(options, app).listen(443);
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

### Validação de Entrada
```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/execute', [
  body('query').isLength({ min: 1, max: 10000 }).escape(),
  // Adicionar mais validações...
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Processar consulta...
});
```

### Lista de Verificação de Segurança
- [ ] Implementar autenticação robusta
- [ ] Usar HTTPS em produção
- [ ] Configurar rate limiting
- [ ] Validar e sanitizar todas as entradas
- [ ] Configurar CORS adequadamente
- [ ] Usar variáveis de ambiente para credenciais
- [ ] Implementar logging de auditoria
- [ ] Configurar firewall de rede
- [ ] Monitorar tentativas de acesso

## 🐛 Troubleshooting

### Problemas de Conexão

#### 1. "TNS: No listener"
```bash
# Verificar se o Oracle Listener está rodando
lsnrctl status

# Iniciar se necessário
lsnrctl start
```

#### 2. "ORA-12514: TNS:listener does not currently know of service"
- Verificar se o Service Name está correto
- Tentar usar SID ao invés de Service Name
- Consultar `listener.ora` no servidor

#### 3. "NJS-530: Cannot connect to database"
```bash
# Testar conectividade básica
ping <hostname>
telnet <hostname> <port>

# Verificar firewall local e remoto
```

#### 4. Instant Client não encontrado
```bash
# Linux/macOS
export LD_LIBRARY_PATH=/path/to/instantclient:$LD_LIBRARY_PATH
export ORACLE_HOME=/path/to/instantclient

# Windows
# Adicionar ao PATH: C:\path\to\instantclient
```

### Problemas de Performance

#### Consultas Lentas
```sql
-- Use EXPLAIN PLAN para analisar
EXPLAIN PLAN FOR your_query;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Considere usar hints
SELECT /*+ FIRST_ROWS(100) */ * FROM large_table;
```

#### Memória Insuficiente
```javascript
// Ajustar em server.js
const options = {
  outFormat: oracledb.OUT_FORMAT_OBJECT,
  fetchArraySize: 1000, // Reduzir se necessário
  maxRows: 10000        // Limitar resultados
};
```

### Logs e Debugging

Ativar logs detalhados:
```javascript
// No início do server.js
process.env.NODE_ORACLEDB_DEBUG = 1;
```

## 🤝 Contribuição

### Como Contribuir

1. **Fork** o repositório
2. **Clone** seu fork localmente
3. **Crie uma branch** para sua feature: `git checkout -b feature/nova-funcionalidade`
4. **Faça commit** das mudanças: `git commit -m 'Adiciona nova funcionalidade'`
5. **Push** para a branch: `git push origin feature/nova-funcionalidade`
6. **Abra um Pull Request**

### Diretrizes de Desenvolvimento

#### Code Style
- Use **2 espaços** para indentação
- **Semicolons** sempre
- **camelCase** para variáveis JavaScript
- **snake_case** para campos SQL

#### Testes
```bash
# Executar testes (quando implementados)
npm test

# Linting
npm run lint
```

#### Documentação
- Documente todas as funções públicas
- Atualize o README para novas funcionalidades
- Inclua exemplos de uso

### Roadmap de Melhorias

- [ ] Sistema de autenticação
- [ ] Suporte a múltiplas conexões simultâneas
- [ ] Editor SQL com autocompletar de schemas
- [ ] Visualizador de execution plans
- [ ] Suporte a outros SGBDs (PostgreSQL, MySQL)
- [ ] Interface para criação/edição de tabelas
- [ ] Sistema de backup/restore
- [ ] Dashboard com métricas de performance

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para detalhes.

## 📞 Suporte

Para reportar bugs ou solicitar funcionalidades, abra uma issue no repositório do projeto.

---

**⚠️ Disclaimer**: Esta ferramenta dá acesso direto ao seu banco de dados Oracle. Use com responsabilidade e implemente medidas de segurança adequadas antes de usar em ambiente de produção.