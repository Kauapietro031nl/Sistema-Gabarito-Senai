const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');

// Inicialização do app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuração do banco de dados
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'db_correcao'
});

db.connect(err => {
    if (err) throw err;
    console.log("Conectado ao banco de dados!");
});

// Função para obter dados do relatório
async function obterRelatorio(id_curso) {
    return new Promise((resolve, reject) => {
        // Primeiro, vamos verificar se o curso existe
        db.query('SELECT id_curso, nome_curso FROM cursos WHERE id_curso = ?', [id_curso], (err, cursoResult) => {
            if (err) {
                console.error('Erro ao verificar curso:', err);
                return reject(err);
            }
            
            if (cursoResult.length === 0) {
                return reject(new Error("Curso não encontrado."));
            }
            
            const curso = cursoResult[0];
            
            // Agora, vamos buscar os resultados dos alunos deste curso
            const sql = `
                SELECT r.matricula, r.nome_aluno, r.acertos, r.diagnostico
                FROM resposta r
                WHERE r.id_curso = ?
                ORDER BY r.acertos DESC, r.nome_aluno
            `;
            
            db.query(sql, [id_curso], (err, alunosResult) => {
                if (err) {
                    console.error('Erro ao buscar resultados dos alunos:', err);
                    return reject(err);
                }
                
                // Formatar o resultado
                const relatorio = {
                    id_curso: curso.id_curso,
                    nome_curso: curso.nome_curso,
                    total_alunos: alunosResult.length,
                    media_acertos: alunosResult.length > 0 ? 
                        (alunosResult.reduce((sum, aluno) => sum + aluno.acertos, 0) / alunosResult.length).toFixed(1) : 0,
                    alunos: alunosResult.map(aluno => ({
                        matricula: aluno.matricula,
                        nome_aluno: aluno.nome_aluno,
                        acertos: aluno.acertos,
                        percentual: ((aluno.acertos / 20) * 100).toFixed(1),
                        diagnostico: aluno.diagnostico ? JSON.parse(aluno.diagnostico) : []
                    }))
                };
                
                resolve(relatorio);
            });
        });
    });
}

// Rota para gerar PDF do relatório
app.get('/gerar-pdf', async (req, res) => {
    const id_curso = req.query.id_curso;
    
    if (!id_curso) {
        return res.status(400).json({ erro: 'ID do curso é obrigatório.' });
    }

    try {
        const dados = await obterRelatorio(id_curso);

        if (!dados) {
            return res.status(404).json({ erro: 'Nenhum dado encontrado para o curso.' });
        }

        if (!dados.alunos || dados.alunos.length === 0) {
            return res.status(404).json({ erro: 'Nenhum aluno encontrado para este curso.' });
        }

        const doc = new PDFDocument();
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio.pdf');
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(18).text(`Relatório do Curso: ${dados.nome_curso || 'Desconhecido'}`, { align: 'center' });
        doc.moveDown();

        doc.fontSize(14).text(`Total de Alunos: ${dados.total_alunos || 0}`);
        doc.text(`Média de Acertos: ${dados.media_acertos || 0} (${((dados.media_acertos / 20) * 100 || 0).toFixed(1)}%)`);
        doc.moveDown();

        doc.fontSize(12).text('Alunos:', { underline: true });

        dados.alunos.forEach(aluno => {
            if (aluno.matricula && aluno.nome_aluno !== undefined && aluno.acertos !== undefined && aluno.percentual !== undefined) {
                doc.text(`${aluno.matricula} - ${aluno.nome_aluno}: ${aluno.acertos} acertos (${aluno.percentual}%)`);
            } else {
                doc.text(`Dados do aluno incompletos.`);
            }
        });

        doc.end();
    } catch (erro) {
        console.error('Erro ao gerar PDF:', erro);
        res.status(500).json({ erro: 'Erro ao gerar PDF: ' + erro.message });
    }
});

// Rota para buscar cursos
app.get('/cursos', (req, res) => {
    const sql = 'SELECT id_curso, nome_curso FROM cursos';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Erro ao buscar cursos:', err);
            return res.status(500).json({ erro: 'Erro ao buscar cursos' });
        }
        
        // Verificar se retornou algum resultado
        if (results.length === 0) {
            // Se não houver cursos, retornar um array vazio
            return res.json([]);
        }
        
        console.log('Cursos encontrados:', results);
        res.json(results);
    });
});

// Rota de cadastro de usuário
app.post('/cadastro', (req, res) => {
    const { cpf, nome, email, senha } = req.body;
    db.query('INSERT INTO instrutores (cpf, nome, email, senha) VALUES (?, ?, ?, ?)',
        [cpf, nome, email, senha],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.status(201).json({ mensagem: "Usuário cadastrado!" });
        }
    );
});

// Rota de login
app.post('/login', (req, res) => {
    const { cpf, senha } = req.body;
    db.query('SELECT * FROM instrutores WHERE cpf = ? AND senha = ?', [cpf, senha],
        (err, result) => {
            if (err || result.length === 0) {
                return res.status(401).json({ erro: "Credenciais inválidas." });
            }
            res.status(200).json({ mensagem: "Login bem-sucedido!" });
        }
    );
});

// Rota de cadastro de gabarito
app.post('/gabarito', (req, res) => {
    const { id_curso, nome_curso, respostas } = req.body;
    
    if (!id_curso || !respostas || typeof respostas !== 'object') {
        return res.status(400).json({ erro: "Envie o ID do curso e as respostas do gabarito." });
    }

    // Primeiro, verificar se já existe um gabarito para este curso
    db.query('SELECT * FROM gabarito WHERE id_curso = ?', [id_curso], (err, results) => {
        if (err) return res.status(500).json({ erro: err.message });

        // Se o gabarito já existe, atualize-o
        if (results.length > 0) {
            // Preparar as partes do SQL para o update
            const updates = Object.entries(respostas).map(([chave, valor]) => `${chave} = ?`).join(', ');
            const valores = [...Object.values(respostas), id_curso];
            
            const updateSql = `UPDATE gabarito SET ${updates} WHERE id_curso = ?`;
            
            db.query(updateSql, valores, (err) => {
                if (err) return res.status(500).json({ erro: err.message });
                return res.status(200).json({ mensagem: "Gabarito atualizado com sucesso!" });
            });
        } 
        // Se não existe, insira um novo gabarito
        else {
            // Primeiro, verifique se o curso existe e, se necessário, crie-o
            if (nome_curso) {
                db.query('INSERT IGNORE INTO cursos (id_curso, nome_curso) VALUES (?, ?)', 
                    [id_curso, nome_curso], 
                    (err) => {
                        if (err) console.error("Erro ao inserir curso:", err);
                    }
                );
            }

            // Agora insira o gabarito
            const colunas = ['id_curso', ...Object.keys(respostas)].join(', ');
            const placeholders = Array(Object.keys(respostas).length + 1).fill('?').join(', ');
            const valores = [id_curso, ...Object.values(respostas)];
            
            const insertSql = `INSERT INTO gabarito (${colunas}) VALUES (${placeholders})`;
            
            db.query(insertSql, valores, (err) => {
                if (err) return res.status(500).json({ erro: err.message });
                return res.status(201).json({ mensagem: "Gabarito cadastrado com sucesso!" });
            });
        }
    });
});

// Rota de correção de prova
app.post('/corrigir', (req, res) => {
    const { matricula, id_curso, nome_aluno, respostas } = req.body;
    
    if (!matricula || !id_curso || !nome_aluno || !respostas) {
        return res.status(400).json({ erro: "Dados incompletos." });
    }

    // Buscar o gabarito correspondente ao curso
    db.query('SELECT * FROM gabarito WHERE id_curso = ?', [id_curso], (err, result) => {
        if (err) return res.status(500).json({ erro: "Erro ao buscar gabarito." });
        if (result.length === 0) return res.status(404).json({ erro: "Gabarito não encontrado para este curso." });

        const gabarito = result[0];
        let acertos = 0;
        let diagnostico = [];

        // Comparar as respostas do aluno com o gabarito
        for (let i = 1; i <= 20; i++) {
            const chave = `r${i}`;
            if (respostas[chave] === gabarito[chave]) {
                acertos++;
            } else {
                diagnostico.push(`Questão ${i}: O aluno respondeu '${respostas[chave]}', resposta correta era '${gabarito[chave]}'`);
            }
        }

        // Salvar o resultado da correção
        db.query('INSERT INTO resposta (matricula, id_curso, nome_aluno, acertos, diagnostico) VALUES (?, ?, ?, ?, ?)',
            [matricula, id_curso, nome_aluno, acertos, JSON.stringify(diagnostico)],
            (err) => {
                if (err) return res.status(500).json({ erro: err.message });
                res.status(200).json({ 
                    mensagem: "Correção realizada com sucesso!", 
                    acertos, 
                    diagnostico 
                });
            }
        );
    });
});

// Rota para gerar relatórios por curso
app.get('/relatorio', (req, res) => {
    const { id_curso } = req.query;
    
    if (!id_curso) {
        return res.status(400).json({ erro: "Informe o ID do curso para gerar o relatório." });
    }
    
    // Primeiro, vamos verificar se o curso existe
    db.query('SELECT id_curso, nome_curso FROM cursos WHERE id_curso = ?', [id_curso], (err, cursoResult) => {
        if (err) {
            console.error('Erro ao verificar curso:', err);
            return res.status(500).json({ erro: "Erro ao verificar curso: " + err.message });
        }
        
        if (cursoResult.length === 0) {
            return res.status(404).json({ erro: "Curso não encontrado." });
        }
        
        const curso = cursoResult[0];
        
        // Agora, vamos buscar os resultados dos alunos deste curso
        const sql = `
            SELECT r.matricula, r.nome_aluno, r.acertos, r.diagnostico
            FROM resposta r
            WHERE r.id_curso = ?
            ORDER BY r.acertos DESC, r.nome_aluno
        `;
        
        db.query(sql, [id_curso], (err, alunosResult) => {
            if (err) {
                console.error('Erro ao buscar resultados dos alunos:', err);
                return res.status(500).json({ erro: "Erro ao buscar resultados: " + err.message });
            }
            
            // Formatar o resultado para enviar ao frontend
            const relatorio = {
                id_curso: curso.id_curso,
                nome_curso: curso.nome_curso,
                total_alunos: alunosResult.length,
                media_acertos: alunosResult.length > 0 ? 
                    (alunosResult.reduce((sum, aluno) => sum + aluno.acertos, 0) / alunosResult.length).toFixed(1) : 0,
                alunos: alunosResult.map(aluno => ({
                    matricula: aluno.matricula,
                    nome_aluno: aluno.nome_aluno,
                    acertos: aluno.acertos,
                    percentual: ((aluno.acertos / 20) * 100).toFixed(1), // Considerando 20 questões
                    diagnostico: aluno.diagnostico ? JSON.parse(aluno.diagnostico) : []
                }))
            };
            
            res.status(200).json(relatorio);
        });
    });
});

// Rota adicional para detalhar o resultado de um aluno específico
app.get('/relatorio/aluno', (req, res) => {
    const { matricula, id_curso } = req.query;
    
    if (!matricula || !id_curso) {
        return res.status(400).json({ erro: "Informe a matrícula e o ID do curso." });
    }
    
    const sql = `
        SELECT r.matricula, r.nome_aluno, r.acertos, r.diagnostico, c.nome_curso
        FROM resposta r
        JOIN cursos c ON r.id_curso = c.id_curso
        WHERE r.matricula = ? AND r.id_curso = ?
    `;
    
    db.query(sql, [matricula, id_curso], (err, result) => {
        if (err) {
            console.error('Erro ao buscar resultado do aluno:', err);
            return res.status(500).json({ erro: "Erro ao buscar resultado: " + err.message });
        }
        
        if (result.length === 0) {
            return res.status(404).json({ erro: "Resultado não encontrado." });
        }
        
        const aluno = result[0];
        
        // Buscar o gabarito do curso para comparação
        db.query('SELECT * FROM gabarito WHERE id_curso = ?', [id_curso], (err, gabaritoResult) => {
            if (err) {
                console.error('Erro ao buscar gabarito:', err);
                return res.status(500).json({ erro: "Erro ao buscar gabarito: " + err.message });
            }
            
            if (gabaritoResult.length === 0) {
                return res.status(404).json({ erro: "Gabarito não encontrado para este curso." });
            }
            
            const gabarito = gabaritoResult[0];
            const diagnostico = aluno.diagnostico ? JSON.parse(aluno.diagnostico) : [];
            
            res.status(200).json({
                matricula: aluno.matricula,
                nome_aluno: aluno.nome_aluno,
                nome_curso: aluno.nome_curso,
                acertos: aluno.acertos,
                percentual: ((aluno.acertos / 20) * 100).toFixed(1),
                diagnostico: diagnostico,
                gabarito: Object.fromEntries(
                    Array.from({length: 20}, (_, i) => [`r${i+1}`, gabarito[`r${i+1}`]])
                )
            });
        });
    });
});

// Iniciando o servidor
app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});




















































// const http = require('http');
// const mysql = require('mysql');
// const url = require('url');

// // Conexão com o banco de dados
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'admin',
//     database: 'db_correcao'
// });

// db.connect(err => {
//     if (err) throw err;
//     console.log("Conectado ao banco de dados!");
// });

// // Criando o servidor
// const server = http.createServer((req, res) => {
//     const parsedUrl = url.parse(req.url, true)
//     let body = ''

//     req.on('data', chunk => {body += chunk.toString()})
//     req.on('end', () => {
//         //Cadastrar usuário
//         if (req.method === 'POST' && parsedUrl.pathname === '/cadastro'){
//             const data = JSON.parse(body)
//             const senhaHash = data.senha; // Sem criptografia

//             db.query('INSERT INTO instrutores (cpf, nome, email, senha) VALUES (?, ?, ?, ?)', 
//                 [data.cpf, data.nome, data.email, senhaHash],
//                 (err) => {
//                     if (err) {
//                         res.writeHead(500, { 'Content-Type': 'application/json' });
//                         res.end(JSON.stringify({ erro: err.message }));
//                     } else {
//                         res.writeHead(201, { 'Content-Type': 'application/json' });
//                         res.end(JSON.stringify({ mensagem: "Usuário cadastrado!" }));
//                     }
//                 }

//             )
//         }

//         //Login
//         else if(req.method === 'POST' && parsedUrl.pathname === '/login') {
//             const data = JSON.parse(body)
//             const senhaHash = data.senha;

//             db.query('SELECT * FROM instrutores WHERE cpf = ? AND senha = ?', [data.cpf, senhaHash], 
//                 (err, result) => {
//                     if(err || result.length === 0){
//                         res.writeHead(401, { 'Content-Type': 'application/json' });
//                         res.end(JSON.stringify({ erro: "Credenciais inválidas." }));
//                         return;
//                     }
//                     res.writeHead(200, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ mensagem: "Login bem-sucedido!" }));
//                 }
//             )
//         }

//         //Cadastrar gabarito
//         else if (req.method === 'POST' && parsedUrl.pathname === '/gabarito') {
//             console.log("📥 Corpo da Requisição (Raw Body):", body);
            
//             let data;
//             try {
//                 data = JSON.parse(body);
//                 console.log("✅ JSON Parseado:", data);
//             } catch (error) {
//                 res.writeHead(400, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify({ erro: "Erro ao processar JSON. Verifique o formato dos dados enviados." }));
//                 return;
//             }
        
//             if (!data.id_curso || !data.respostas || typeof data.respostas !== 'object') {
//                 console.log("❌ Erro: ID do curso ou respostas não foram enviados corretamente.");
//                 console.log("👉 ID do Curso:", data.id_curso);
//                 console.log("👉 Respostas:", data.respostas);
                
//                 res.writeHead(400, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify({ erro: "Envie o ID do curso e as respostas do gabarito." }));
//                 return;
//             }
        
//             console.log("✅ ID do Curso:", data.id_curso);
//             console.log("✅ Respostas:", JSON.stringify(data.respostas));
        
//             const colunas = Object.keys(data.respostas).join(', ');
//             const valores = Object.values(data.respostas);
//             const placeholders = valores.map(() => '?').join(', ');
        
//             const sql = `INSERT INTO gabarito (id_curso, ${colunas}) VALUES (?, ${placeholders})`;
        
//             db.query(sql, [data.id_curso, ...valores], (err) => {
//                 if (err) {
//                     res.writeHead(500, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ erro: err.message }));
//                 } else {
//                     res.writeHead(201, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ mensagem: "Gabarito cadastrado!" }));
//                 }
//             });
//         }
        
        
           

//         //Correção de Prova
//         else if (req.method === 'POST' && parsedUrl.pathname === '/corrigir') {
//             const data = JSON.parse(body);
            
//             console.log("📌 Dados recebidos para correção:", data);
        
//             if (!data.respostas || !data.matricula || !data.id_curso || !data.nome_aluno) {
//                 res.writeHead(400, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify({ erro: "Envie o ID do curso, a matrícula do aluno, o nome do aluno e as respostas." }));
//                 return;
//             }
        
//             // Busca o gabarito correto baseado no ID do curso
//             db.query('SELECT * FROM gabarito WHERE id_curso = ?', [data.id_curso], (err, result) => {
//                 if (err) {
//                     console.error("❌ Erro ao buscar gabarito:", err.message);
//                     res.writeHead(500, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ erro: "Erro ao buscar gabarito." }));
//                     return;
//                 }
        
//                 if (result.length === 0) {
//                     res.writeHead(404, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ erro: "Gabarito não encontrado para esse curso." }));
//                     return;
//                 }
        
//                 let gabarito = result[0];
//                 let acertos = 0;
//                 let diagnostico = [];
        
//                 // Compara respostas do aluno com o gabarito
//                 for (let i = 1; i <= 20; i++) {
//                     let respostaAluno = data.respostas[`r${i}`];
//                     let respostaCorreta = gabarito[`r${i}`];
        
//                     if (respostaAluno === respostaCorreta) {
//                         acertos++;
//                     } else {
//                         diagnostico.push(`Errou a questão ${i}: Resposta correta era '${respostaCorreta}'`);
//                     }
//                 }
        
//                 console.log(`✅ Aluno ${data.matricula} (${data.nome_aluno}) acertou ${acertos} questões.`);
        
//                 // Verifica se a resposta já existe no banco
//                 db.query('SELECT * FROM resposta WHERE matricula = ? AND id_curso = ?', [data.matricula, data.id_curso], (err, existing) => {
//                     if (err) {
//                         console.error("❌ Erro ao verificar respostas do aluno:", err.message);
//                         res.writeHead(500, { 'Content-Type': 'application/json' });
//                         res.end(JSON.stringify({ erro: "Erro ao verificar respostas do aluno." }));
//                         return;
//                     }
        
//                     if (existing.length > 0) {
//                         // Atualiza as respostas do aluno se já existir
//                         db.query(
//                             'UPDATE resposta SET nome_aluno = ?, acertos = ?, diagnostico = ? WHERE matricula = ? AND id_curso = ?',
//                             [data.nome_aluno, acertos, JSON.stringify(diagnostico), data.matricula, data.id_curso],
//                             (err) => {
//                                 if (err) {
//                                     console.error("❌ Erro ao atualizar correção:", err.message);
//                                     res.writeHead(500, { 'Content-Type': 'application/json' });
//                                     res.end(JSON.stringify({ erro: err.message }));
//                                 } else {
//                                     console.log("✅ Correção atualizada com sucesso!");
//                                     res.writeHead(200, { 'Content-Type': 'application/json' });
//                                     res.end(JSON.stringify({ mensagem: "Correção atualizada!", acertos, diagnostico }));
//                                 }
//                             }
//                         );
//                     } else {
//                         // Insere nova correção
//                         db.query(
//                             'INSERT INTO resposta (matricula, id_curso, nome_aluno, acertos, diagnostico) VALUES (?, ?, ?, ?, ?)',
//                             [data.matricula, data.id_curso, data.nome_aluno, acertos, JSON.stringify(diagnostico)],
//                             (err) => {
//                                 if (err) {
//                                     console.error("❌ Erro ao salvar correção:", err.message);
//                                     res.writeHead(500, { 'Content-Type': 'application/json' });
//                                     res.end(JSON.stringify({ erro: err.message }));
//                                 } else {
//                                     console.log("✅ Correção salva com sucesso!");
//                                     res.writeHead(201, { 'Content-Type': 'application/json' });
//                                     res.end(JSON.stringify({ mensagem: "Correção salva com sucesso!", acertos, diagnostico }));
//                                 }
//                             }
//                         );
//                     }
//                 });
//             });
//         }
        
        

//         else if (req.method === 'GET' && parsedUrl.pathname === '/relatorio') {
//             const queryParams = url.parse(req.url, true).query;
//             const id_curso = queryParams.id_curso;
        
//             if (!id_curso) {
//                 console.log("❌ Erro: ID do curso não foi enviado.");
//                 res.writeHead(400, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify({ erro: "Informe o ID do curso." }));
//                 return;
//             }
        
//             console.log(`📥 Buscando relatório do curso ${id_curso}...`);
        
//             const sql = `
//                 SELECT r.matricula, r.nome_aluno, r.acertos, c.nome_curso
//                 FROM resposta r
//                 JOIN cursos c ON r.id_curso = c.id_curso
//                 WHERE r.id_curso = ?;
//             `;
        
//             db.query(sql, [id_curso], (err, results) => {
//                 if (err) {
//                     console.log("❌ Erro no banco de dados:", err.message);
//                     res.writeHead(500, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ erro: err.message }));
//                     return;
//                 }
        
//                 console.log("✅ Dados retornados do banco:", results);
        
//                 if (results.length === 0) {
//                     console.log("⚠️ Nenhum dado encontrado para o curso.");
//                     res.writeHead(404, { 'Content-Type': 'application/json' });
//                     res.end(JSON.stringify({ erro: "Nenhum relatório encontrado para este curso." }));
//                     return;
//                 }
        
//                 const relatorio = {
//                     id_curso: id_curso,
//                     nome_curso: results[0].nome_curso,
//                     data_criacao: new Date().toISOString().split('T')[0],
//                     alunos: results.map(aluno => ({
//                         matricula: aluno.matricula_aluno,
//                         nome_aluno: aluno.nome_aluno,
//                         acertos: aluno.acertos
//                     }))
//                 };
        
//                 console.log("📤 Enviando relatório:", relatorio);
//                 res.writeHead(200, { 'Content-Type': 'application/json' });
//                 res.end(JSON.stringify(relatorio));
//             });

//         }
        
        
        
        
        
//     })
// })


// server.listen(3000, () => {
//     console.log("Servidor rodando na porta 3000");
// });
