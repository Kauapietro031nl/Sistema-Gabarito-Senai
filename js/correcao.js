document.addEventListener("DOMContentLoaded", function () {
    console.log("Script carregado!");
    
    // Carregar cursos quando a página iniciar
    carregarCursos();
    
    const form = document.getElementById("formulario-correcao");
    const perguntasContainer = document.getElementById("perguntas-container");
    
    // Garantir que o elemento resultado existe
    let resultadoDiv = document.getElementById("resultado");
    if (!resultadoDiv) {
        resultadoDiv = document.createElement("div");
        resultadoDiv.id = "resultado";
        document.body.appendChild(resultadoDiv);
        console.log("Elemento resultado criado dinamicamente");
    }
    
    // Criar perguntas de 1 a 20 com opções A, B, C, D
    for (let i = 1; i <= 20; i++) {
        const perguntaDiv = document.createElement("div");
        perguntaDiv.classList.add("pergunta");
        perguntaDiv.innerHTML = `<p>Questão ${i}:</p>`;
        
        const opcoesDiv = document.createElement("div");
        opcoesDiv.classList.add("opcoes");
        
        ["A", "B", "C", "D"].forEach((letra) => {
            const opcoesLabel = document.createElement("label");
            opcoesLabel.classList.add("opcao");
            opcoesLabel.innerHTML = `
                <input type="radio" name="r${i}" value="${letra}"> 
            `;
            opcoesDiv.appendChild(opcoesLabel);
        });
        
        perguntaDiv.appendChild(opcoesDiv);
        perguntasContainer.appendChild(perguntaDiv);
    }
    
    // Adicionar evento de envio do formulário
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        console.log("Formulário enviado!");
        
        try {
            // Capturar dados do formulário - usando o ID correto do select
            const matricula = document.getElementById("matricula").value;
            const nome_aluno = document.getElementById("nome_aluno").value;
            const id_curso = document.getElementById("curso").value;
            
            if (!matricula || !nome_aluno || !id_curso) {
                alert("Por favor, preencha todos os campos obrigatórios!");
                return;
            }
            
            // Capturar respostas das perguntas
            const respostas = {};
            let todasRespondidas = true;
            
            for (let i = 1; i <= 20; i++) {
                const respostaSelecionada = document.querySelector(`input[name="r${i}"]:checked`);
                if (respostaSelecionada) {
                    respostas[`r${i}`] = respostaSelecionada.value;
                } else {
                    todasRespondidas = false;
                    alert(`Por favor, responda a questão ${i}.`);
                    return;
                }
            }
            
            if (!todasRespondidas) {
                return;
            }
            
            // Montar objeto para enviar ao backend
            const dadosParaEnviar = {
                matricula: matricula,
                nome_aluno: nome_aluno,
                id_curso: id_curso,
                respostas: respostas
            };
            
            console.log("Dados a serem enviados:", dadosParaEnviar);
            
            // Enviar dados para o backend
            const resposta = await fetch("http://localhost:3000/corrigir", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dadosParaEnviar)
            });
            
            // Verificar se a resposta foi bem-sucedida
            if (!resposta.ok) {
                const errorData = await resposta.json();
                throw new Error(errorData.erro || `Erro HTTP: ${resposta.status}`);
            }
            
            // Processar resposta
            const resultado = await resposta.json();
            console.log("Resposta do servidor:", resultado);
            
            // Verificar que o resultado tem todas as propriedades necessárias
            if (!resultado || !resultado.acertos || !resultado.diagnostico) {
                throw new Error("Formato de resposta inválido do servidor");
            }
            
            // Verificar novamente se o elemento resultado existe
            resultadoDiv = document.getElementById("resultado");
            if (!resultadoDiv) {
                resultadoDiv = document.createElement("div");
                resultadoDiv.id = "resultado";
                document.body.appendChild(resultadoDiv);
            }
            
            // Exibir resultados
            resultadoDiv.innerHTML = `
                <h2>Resultado da Correção</h2>
                <p><strong>Acertos:</strong> ${resultado.acertos} de 20</p>
                <p><strong>Percentual:</strong> ${(resultado.acertos / 20 * 100).toFixed(1)}%</p>
                <h3>Diagnóstico:</h3>
                <ul>
                    ${resultado.diagnostico.map(item => `<li>${item}</li>`).join('')}
                </ul>
            `;
            
            // Rolar para o resultado
            resultadoDiv.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error("Erro ao enviar respostas:", error);
            alert(`Erro ao enviar respostas: ${error.message}`);
            
            // Mesmo com erro, tenta exibir mensagem no div de resultado
            if (resultadoDiv) {
                resultadoDiv.innerHTML = `
                    <h2>Erro ao processar resultado</h2>
                    <p>Ocorreu um erro: ${error.message}</p>
                    <p>Por favor, tente novamente ou contate o suporte.</p>
                `;
            }
        }
    });
});

async function carregarCursos() {
    try {
        const resposta = await fetch('http://localhost:3000/cursos');
        
        if (!resposta.ok) {
            throw new Error(`Erro HTTP: ${resposta.status}`);
        }
        
        const cursos = await resposta.json();
        const selectCurso = document.getElementById('curso');
        
        // Limpar opções existentes
        selectCurso.innerHTML = '<option value="">Selecione um curso</option>';
        
        // Adicionar os cursos do banco de dados
        cursos.forEach(curso => {
            const option = document.createElement('option');
            option.value = curso.id_curso;
            option.textContent = curso.nome_curso;
            selectCurso.appendChild(option);
        });
        
        console.log('Cursos carregados com sucesso:', cursos);
    } catch (erro) {
        console.error('Erro ao carregar cursos:', erro);
        alert('Não foi possível carregar a lista de cursos. Por favor, tente novamente mais tarde.');
    }
}