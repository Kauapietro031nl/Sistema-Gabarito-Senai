document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("formulario-gabarito");
    const perguntasContainer = document.getElementById("gabarito-container");
    
    // Chamada da função para carregar os cursos
    carregarCursos();
    
    // Criar campos de perguntas dinamicamente
    for (let i = 1; i <= 20; i++) {
        const perguntaDiv = document.createElement("div");
        perguntaDiv.classList.add("pergunta");
        perguntaDiv.innerHTML = `<p>Questão ${i}:</p>`;
        
        const opcoesDiv = document.createElement("div");
        opcoesDiv.classList.add("opcoes");
        
        ["A", "B", "C", "D"].forEach((letra) => {
            const label = document.createElement("label");
            label.classList.add("opcao");
            label.innerHTML = `<input type="radio" name="r${i}" value="${letra}"> `;
            opcoesDiv.appendChild(label);
        });
        
        perguntaDiv.appendChild(opcoesDiv);
        perguntasContainer.appendChild(perguntaDiv);
    }
    
    // Verificar se o botão de submissão já existe
    const existingButton = form.querySelector('button[type="submit"]');
    if (!existingButton) {
        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.textContent = "Salvar Gabarito";
        form.appendChild(submitButton);
    }
    
    // Adicionar evento de envio do formulário (apenas um listener)
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        console.log("Formulário de gabarito enviado!");
        
        try {
            // Capturar dados do formulário - usando o select de curso corretamente
            const selectCurso = document.getElementById("curso");
            const id_curso = selectCurso.value;
            const nome_curso = selectCurso.options[selectCurso.selectedIndex].text;
            
            if (!id_curso) {
                alert("Por favor, selecione um curso!");
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
                id_curso: id_curso,
                nome_curso: nome_curso,
                respostas: respostas
            };
            
            console.log("Dados do gabarito a serem enviados:", dadosParaEnviar);
            
            // Enviar dados para o backend
            const resposta = await fetch("http://localhost:3000/gabarito", {
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
            
            // Mostrar mensagem de sucesso
            alert(resultado.mensagem || "Gabarito cadastrado com sucesso!");
            
            // Limpar o formulário após o cadastro bem-sucedido
            form.reset();
            
        } catch (error) {
            console.error("Erro ao cadastrar gabarito:", error);
            alert(`Erro ao cadastrar gabarito: ${error.message}`);
        }
    });
});

// Função para carregar os cursos do backend
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
