const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração Oracle
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let connection = null;

// Rota para testar conexão
app.post('/api/connect', async (req, res) => {
    try {
        const { hostname, port, serviceName, username, password } = req.body;
        
        console.log('Tentando conectar com:', {
            hostname,
            port,
            serviceName,
            username: username
        });
        
        // Fechar conexão anterior se existir
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.log('Erro ao fechar conexão anterior:', err.message);
            }
            connection = null;
        }

        // Diferentes formatos de connection string para testar
        const connectionConfigs = [
            // Formato 1: host:port/service_name
            {
                user: username,
                password: password,
                connectString: `${hostname}:${port}/${serviceName}`
            },
            // Formato 2: host:port:sid (para SID ao invés de service name)
            {
                user: username,
                password: password,
                connectString: `${hostname}:${port}:${serviceName}`
            },
            // Formato 3: TNS format mais explícito
            {
                user: username,
                password: password,
                connectString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${hostname})(PORT=${port}))(CONNECT_DATA=(SERVICE_NAME=${serviceName})))`
            }
        ];

        let lastError = null;
        let connectionSuccess = false;

        // Tentar cada formato de conexão
        for (let i = 0; i < connectionConfigs.length; i++) {
            const config = connectionConfigs[i];
            console.log(`Tentativa ${i + 1} - Connection String: ${config.connectString}`);
            
            try {
                connection = await oracledb.getConnection(config);
                console.log('Conexão estabelecida com sucesso!');
                connectionSuccess = true;
                break;
            } catch (error) {
                console.log(`Tentativa ${i + 1} falhou:`, error.message);
                lastError = error;
                connection = null;
                
                // Se for erro de credenciais, não tentar outros formatos
                if (error.message.includes('ORA-01017') || error.message.includes('invalid username/password')) {
                    break;
                }
            }
        }

        if (!connectionSuccess) {
            throw lastError;
        }

        res.json({ 
            success: true, 
            message: 'Conectado com sucesso ao Oracle Database',
            server: `${hostname}:${port}`,
            service: serviceName,
            user: username
        });

    } catch (error) {
        console.error('Erro na conexão:', error);
        
        // Mensagens de erro mais específicas
        let errorMessage = error.message;
        let suggestions = [];

        if (error.message.includes('NJS-530')) {
            errorMessage = 'Não foi possível conectar ao servidor Oracle';
            suggestions = [
                'Verifique se o hostname/IP está correto',
                'Confirme se a porta está correta (padrão: 1521)',
                'Teste a conectividade: ping ' + req.body.hostname,
                'Verifique se não há firewall bloqueando a porta',
                'Confirme se o Oracle Database está rodando'
            ];
        } else if (error.message.includes('ORA-12541')) {
            errorMessage = 'TNS: No listener';
            suggestions = [
                'O Oracle Listener não está rodando',
                'Verifique se o serviço Oracle Listener está ativo',
                'Confirme a porta do listener (padrão: 1521)'
            ];
        } else if (error.message.includes('ORA-12514')) {
            errorMessage = 'TNS: Listener não reconhece o service name';
            suggestions = [
                'Verifique se o Service Name está correto',
                'Tente usar SID ao invés de Service Name',
                'Consulte o arquivo tnsnames.ora ou listener.ora'
            ];
        } else if (error.message.includes('ORA-01017')) {
            errorMessage = 'Usuário ou senha inválidos';
            suggestions = [
                'Verifique o nome de usuário',
                'Confirme a senha',
                'Verifique se a conta não está bloqueada'
            ];
        }

        res.status(500).json({ 
            success: false, 
            message: errorMessage,
            suggestions: suggestions,
            originalError: error.message
        });
    }
});

// Rota para desconectar
app.post('/api/disconnect', async (req, res) => {
    try {
        if (connection) {
            await connection.close();
            connection = null;
        }
        
        res.json({ 
            success: true, 
            message: 'Desconectado do Oracle Database' 
        });

    } catch (error) {
        console.error('Erro na desconexão:', error);
        res.status(500).json({ 
            success: false, 
            message: `Erro na desconexão: ${error.message}` 
        });
    }
});

// Rota para executar queries
app.post('/api/execute', async (req, res) => {
    try {
        if (!connection) {
            return res.status(400).json({ 
                success: false, 
                message: 'Não há conexão ativa com o banco de dados' 
            });
        }

        let { query, page, pageSize } = req.body;
        page = parseInt(page) || 1;
        pageSize = parseInt(pageSize) || 0; // 0 significa sem paginação

        if (!query || query.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Query SQL é obrigatória' 
            });
        }

        query = query.trim().replace(/;$/, ''); // remover ponto-e-vírgula final

        console.log('Executando query:', query, 'page:', page, 'pageSize:', pageSize);

        // Se paginação solicitada
        let rows = [];
        let totalCount = null;

        if (pageSize > 0) {
            // Não aplicar paginação automática se o usuário já limitou a query
            const lowerQ = query.toLowerCase();
            const hasRowLimit = /\b(rownum|row_number|offset|fetch)\b/i.test(lowerQ);
            if (hasRowLimit) {
                // Executar query sem encapsular/pagination para respeitar a limitação do usuário
                const result = await connection.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
                rows = result.rows || [];
            } else {
                // contar total
                try {
                    const countSql = `SELECT COUNT(*) AS CNT FROM (${query})`;
                    const cntRes = await connection.execute(countSql);
                    totalCount = (cntRes.rows && cntRes.rows[0] && (cntRes.rows[0].CNT || cntRes.rows[0].cnt)) || 0;
                } catch (errCount) {
                    console.warn('Não foi possível obter totalCount:', errCount.message);
                    totalCount = null;
                }

                const offset = (page - 1) * pageSize;
                const paginatedSql = `SELECT * FROM (${query}) t OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
                const opts = { outFormat: oracledb.OUT_FORMAT_OBJECT };
                const binds = { offset, limit: pageSize };
                const result = await connection.execute(paginatedSql, binds, opts);
                rows = result.rows || [];
            }
        } else {
            const result = await connection.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
            rows = result.rows || [];
        }

        console.log('Query executada. Linhas retornadas:', rows.length);

        // preparar rows seguros para JSON (evitar estruturas circulares)
        const safeRows = (rows || []).map(r => {
            if (r === null || typeof r !== 'object') return r;
            const out = {};
            Object.keys(r).forEach(k => {
                const v = r[k];
                try {
                    if (v instanceof Date) {
                        out[k] = v.toISOString();
                    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) {
                        out[k] = v.toString('base64');
                    } else if (v && typeof v === 'object') {
                        // evitar JSON.stringify direto em objetos possivelmente circulares
                        if (typeof v.toString === 'function' && v.toString !== Object.prototype.toString) {
                            out[k] = v.toString();
                        } else {
                            out[k] = String(v);
                        }
                    } else {
                        out[k] = v;
                    }
                } catch (e) {
                    out[k] = String(v);
                }
            });
            return out;
        });

        return res.json({ success: true, results: safeRows, totalCount, page, pageSize });

    } catch (error) {
        console.error('Erro na execução da query:', error);
        res.status(500).json({ 
            success: false, 
            message: `Erro na execução: ${error.message}` 
        });
    }
});

// Rota para listar tabelas
app.get('/api/tables', async (req, res) => {
    try {
        if (!connection) {
            return res.status(400).json({ success: false, message: 'Não conectado ao banco' });
        }

        // Listar tabelas acessíveis ao usuário, mostrando owner.table_name
        const result = await connection.execute(`
            SELECT owner || '.' || table_name AS TABLE_NAME
            FROM all_tables
            WHERE owner NOT IN ('SYS','SYSTEM','SYS$UMF','OUTLN','APPQOSSYS','DBSNMP','WMSYS')
              AND table_name NOT LIKE 'BIN$%'
            ORDER BY owner, table_name
        `);

        const tables = (result.rows || []).map(r => r.TABLE_NAME || r.table_name || r.tableName);

        res.json({ 
            success: true,
            tables
        });
        
    } catch (error) {
        console.error('Erro ao listar tabelas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Rota para descrever tabela (colunas)
app.post('/api/describe', async (req, res) => {
    try {
        if (!connection) return res.status(400).json({ success: false, message: 'Não conectado ao banco' });

        const { table } = req.body;
        if (!table) return res.status(400).json({ success: false, message: 'Nome da tabela é obrigatório' });

        let owner, tableName;
        if (table.includes('.')) {
            [owner, tableName] = table.split('.');
        } else {
            // obter usuário atual
            const userRes = await connection.execute(`SELECT USER FROM DUAL`);
            owner = (userRes.rows && userRes.rows[0] && (userRes.rows[0].USER || userRes.rows[0].USER)) || null;
            tableName = table;
        }

        // limpar e normalizar
        owner = (owner || '').toString().trim();
        tableName = (tableName || '').toString().trim();
        // remover aspas se houver
        owner = owner.replace(/^"(.*)"$/, '$1');
        tableName = tableName.replace(/^"(.*)"$/, '$1');
        owner = owner.toUpperCase();
        tableName = tableName.toUpperCase();

        // validar nomes (apenas caracteres permitidos em identificadores Oracle simples)
        const namePattern = /^[A-Z0-9_$#]+$/;
        if (!namePattern.test(owner) || !namePattern.test(tableName)) {
            return res.status(400).json({ success: false, message: 'Nome do owner ou tabela contém caracteres inválidos. Use formato SCHEMA.TABELA sem aspas.' });
        }

        const colRes = await connection.execute(
            `SELECT column_name, data_type, data_length, data_precision, data_scale, nullable
             FROM all_tab_columns
             WHERE owner = :p_owner AND table_name = :p_table
             ORDER BY column_id`,
            { p_owner: owner, p_table: tableName },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const columns = (colRes.rows || []).map(r => ({
            column_name: r.COLUMN_NAME || r.column_name,
            data_type: r.DATA_TYPE || r.data_type,
            data_length: r.DATA_LENGTH || r.data_length,
            data_precision: r.DATA_PRECISION || r.data_precision,
            data_scale: r.DATA_SCALE || r.data_scale,
            nullable: r.NULLABLE || r.nullable
        }));

        res.json({ success: true, owner, table: tableName, columns });

    } catch (error) {
        console.error('Erro em /api/describe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Rota para verificar status da conexão
app.get('/api/status', (req, res) => {
    res.json({ 
        connected: connection !== null,
        timestamp: new Date().toISOString()
    });
});

// Servir arquivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para diagnóstico de conexão
app.post('/api/diagnose', async (req, res) => {
    const { hostname, port } = req.body;
    
    // Teste básico de conectividade
    const { spawn } = require('child_process');
    
    try {
        // No Windows, use 'ping -n 1', no Unix use 'ping -c 1'
        const isWindows = process.platform === 'win32';
        const pingCmd = isWindows ? 'ping' : 'ping';
        const pingArgs = isWindows ? ['-n', '1', hostname] : ['-c', '1', hostname];
        
        const ping = spawn(pingCmd, pingArgs);
        
        let pingResult = '';
        ping.stdout.on('data', (data) => {
            pingResult += data.toString();
        });
        
        ping.on('close', (code) => {
            res.json({
                hostname,
                port,
                pingSuccess: code === 0,
                pingResult: pingResult,
                suggestions: code === 0 
                    ? ['Host alcançável - problema pode ser na porta ou configuração do Oracle']
                    : ['Host não alcançável - verifique hostname/IP e conectividade de rede']
            });
        });
        
        // Timeout para o ping
        setTimeout(() => {
            ping.kill();
            res.json({
                hostname,
                port,
                pingSuccess: false,
                pingResult: 'Timeout',
                suggestions: ['Timeout no ping - verifique conectividade de rede']
            });
        }, 5000);
        
    } catch (error) {
        res.json({
            hostname,
            port,
            pingSuccess: false,
            pingResult: error.message,
            suggestions: ['Erro ao executar ping']
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📊 Oracle Query Tool disponível em http://localhost:${PORT}`);
    
    // Abrir navegador automaticamente
    openBrowser(`http://localhost:${PORT}`);
});

// Função para abrir o navegador
function openBrowser(url) {
    const platform = process.platform;
    let command;
    
    switch (platform) {
        case 'darwin':  // macOS
            command = `open ${url}`;
            break;
        case 'win32':   // Windows
            command = `start ${url}`;
            break;
        default:        // Linux e outros
            command = `xdg-open ${url}`;
            break;
    }
    
    // Aguardar um pouco para o servidor estar pronto
    setTimeout(() => {
        exec(command, (error) => {
            if (error) {
                console.log('⚠️ Não foi possível abrir o navegador automaticamente');
                console.log(`🌐 Acesse manualmente: ${url}`);
            } else {
                console.log('🌐 Navegador aberto automaticamente!');
            }
        });
    }, 1000);
}

// Tratamento de encerramento
process.on('SIGINT', async () => {
    console.log('\n🔌 Fechando conexões...');
    if (connection) {
        try {
            await connection.close();
            console.log('✅ Conexão Oracle fechada com sucesso');
        } catch (err) {
            console.error('❌ Erro ao fechar conexão:', err);
        }
    }
    process.exit(0);
});