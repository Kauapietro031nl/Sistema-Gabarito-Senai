document.addEventListener('DOMContentLoaded', function() {
    // Carregar cursos ao iniciar a página
    carregarCursos();
    
    // Adicionar eventos
    document.getElementById('btn-gerar-relatorio').addEventListener('click', gerarRelatorio);
    document.getElementById('btn-baixar-pdf').addEventListener('click', baixarPdfTurma);
    document.getElementById('btn-baixar-pdf-individual').addEventListener('click', baixarPdfIndividual);
    
    // Evento de clique na tabela para selecionar aluno
    document.getElementById('tabela-relatorio').addEventListener('click', function(e) {
        const row = e.target.closest('tr');
        if (row && row.dataset.matricula) {
            selecionarAluno(row.dataset.matricula);
        }
    });
});

// Variáveis globais
let dadosRelatorio = null;
let alunoSelecionado = null;

// Função para carregar os cursos do backend
async function carregarCursos() {
    try {
        const resposta = await fetch('http://localhost:3000/cursos');
        
        if (!resposta.ok) {
            const erro = await resposta.json();
            throw new Error(erro.erro || `Erro HTTP: ${resposta.status}`);
        }
        
        const cursos = await resposta.json();
        const selectCurso = document.getElementById('curso');
        
        // Limpar opções existentes, exceto a primeira
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
        alert('Não foi possível carregar a lista de cursos: ' + erro.message);
    }
}

// Função para gerar o relatório
async function gerarRelatorio() {
    const id_curso = document.getElementById('curso').value;
    
    if (!id_curso) {
        alert('Por favor, selecione um curso para gerar o relatório.');
        return;
    }
    
    try {
        const resposta = await fetch(`http://localhost:3000/relatorio?id_curso=${id_curso}`);
        
        if (!resposta.ok) {
            const erro = await resposta.json();
            throw new Error(erro.erro || `Erro HTTP: ${resposta.status}`);
        }
        
        dadosRelatorio = await resposta.json();
        exibirRelatorio(dadosRelatorio);
        
        // Mostrar o container do relatório e botão de PDF
        document.getElementById('relatorio-container').classList.remove('hidden');
        document.getElementById('btn-baixar-pdf').classList.remove('hidden');
        
        // Esconder detalhes do aluno se estiver visível
        document.getElementById('detalhe-aluno').classList.add('hidden');
    } catch (erro) {
        console.error('Erro ao gerar relatório:', erro);
        alert(`Erro ao gerar relatório: ${erro.message}`);
    }
}

// Função para exibir o relatório na página
function exibirRelatorio(dados) {
    // Atualizar informações básicas
    document.getElementById('nome-curso').textContent = dados.nome_curso;
    document.getElementById('total-alunos').textContent = dados.total_alunos;
    document.getElementById('media-acertos').textContent = dados.media_acertos;
    
    // Calcular e exibir percentual médio
    const percentualMedio = ((dados.media_acertos / 20) * 100).toFixed(1);
    document.getElementById('media-percentual').textContent = `${percentualMedio}%`;
    
    // Atualizar tabela de alunos
    const tabelaRelatorio = document.getElementById('tabela-relatorio');
    tabelaRelatorio.innerHTML = ''; // Limpar conteúdo anterior
    
    // Adicionar os alunos à tabela
    dados.alunos.forEach(aluno => {
        const tr = document.createElement('tr');
        tr.dataset.matricula = aluno.matricula;
        
        // Definir classe CSS baseada no percentual de acertos
        let classeAcertos = '';
        const percentual = parseFloat(aluno.percentual);
        if (percentual >= 70) {
            classeAcertos = 'acertos-alto';
        } else if (percentual >= 50) {
            classeAcertos = 'acertos-medio';
        } else {
            classeAcertos = 'acertos-baixo';
        }
        
        tr.innerHTML = `
            <td>${aluno.matricula}</td>
            <td>${aluno.nome_aluno}</td>
            <td class="${classeAcertos}">${aluno.acertos}</td>
            <td class="${classeAcertos}">${aluno.percentual}%</td>
        `;
        
        tabelaRelatorio.appendChild(tr);
    });
}

// Função para selecionar um aluno
function selecionarAluno(matricula) {
    if (!dadosRelatorio) return;

    // Encontra o aluno nos dados do relatório
    alunoSelecionado = dadosRelatorio.alunos.find(a => a.matricula === matricula);
    if (!alunoSelecionado) return;

    // Atualiza a seção de detalhes
    document.getElementById('nome-aluno-detalhe').textContent = alunoSelecionado.nome_aluno;
    document.getElementById('matricula-detalhe').textContent = alunoSelecionado.matricula;
    document.getElementById('curso-detalhe').textContent = dadosRelatorio.nome_curso;
    document.getElementById('acertos-detalhe').textContent = alunoSelecionado.acertos;
    document.getElementById('percentual-detalhe').textContent = alunoSelecionado.percentual + '%';

    // Preenche o diagnóstico
    const diagnosticoLista = document.getElementById('diagnostico-lista');
    diagnosticoLista.innerHTML = '';
    
    if (alunoSelecionado.diagnostico && alunoSelecionado.diagnostico.length > 0) {
        alunoSelecionado.diagnostico.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            diagnosticoLista.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'O aluno acertou todas as questões!';
        diagnosticoLista.appendChild(li);
    }

    // Mostra a seção de detalhes
    document.getElementById('detalhe-aluno').classList.remove('hidden');
}

// Função para baixar PDF da turma toda
async function baixarPdfTurma() {
    const idCurso = document.getElementById('curso').value;
    if (!idCurso) {
        alert('Selecione um curso primeiro');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/gerar-pdf?id_curso=${idCurso}`);
        if (!response.ok) throw new Error('Erro ao gerar PDF');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_turma_${idCurso}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao baixar PDF:', error);
        alert('Erro ao baixar PDF. Verifique o console para mais detalhes.');
    }
}

// Função para baixar PDF individual
async function baixarPdfIndividual() {
    if (!alunoSelecionado) {
        alert('Selecione um aluno primeiro');
        return;
    }

    const idCurso = document.getElementById('curso').value;
    if (!idCurso) {
        alert('Selecione um curso primeiro');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/gerar-pdf-individual?id_curso=${idCurso}&matricula=${alunoSelecionado.matricula}`);
        if (!response.ok) throw new Error('Erro ao gerar PDF individual');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${alunoSelecionado.matricula}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao baixar PDF individual:', error);
        alert('Erro ao baixar PDF individual. Verifique o console para mais detalhes.');
    }
}