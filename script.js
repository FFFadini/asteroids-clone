/* ==========================================
   CONFIGURAÇÕES E DADOS
   ========================================== */
const TIPOS_METEOROS = {
    'verde':    { vida: 1, cor: '#00ff00', pontos: 100, fragmenta: false },
    'azul':     { vida: 2, cor: '#0000ff', pontos: 200, fragmenta: false },
    'vermelho': { vida: 4, cor: '#ff0000', pontos: 500, fragmenta: false },
    'roxo':     { vida: 1, cor: '#800080', pontos: 300, fragmenta: true }
};
// criação de niveis
const CONFIG_NIVEIS = {
    1: { maxMeteoros: 3,  spawnRate: 2000, velocidade: .5, tipos: ['verde'] },
    2: { maxMeteoros: 5,  spawnRate: 1800, velocidade: .5, tipos: ['verde', 'azul'] },
    3: { maxMeteoros: 7,  spawnRate: 1500, velocidade: .5, tipos: ['verde', 'azul', 'roxo'] },
    4: { maxMeteoros: 10, spawnRate: 1200, velocidade: .3, tipos: ['azul', 'vermelho', 'roxo'] },
    'infinito': { maxMeteoros: 15, spawnRate: 800, velocidade: 1, tipos: ['verde','azul', 'vermelho', 'roxo'] }
};

//powersUp
const UPGRADES = {
    'laser':     { cor: '#ffffff', classeNave: 'nave-branca', tempo: 5000, chance: 0.10 },
    'cone':      { cor: '#0000ff', classeNave: 'nave-azul',   tempo: 7000, chance: 0.05 },
    'explosivo': { cor: '#ff0000', classeNave: 'nave-vermelha', tempo: 4000, chance: 0.01 }
};

/* ==========================================
   VARIÁVEIS GLOBAIS
   ========================================== */
//criação das formas dos Asteroids
const formasMeteoros = [ 
    "50,10 250,50 290,150 200,290 10,250", 
    "100,10 200,30 280,100 250,250 50,280 10,100", 
    "150,0 280,80 250,250 150,290 20,200 50,50" 
];

let meteorosAtivos = [];
let lasersAtivos = [];
let particulasAtivas = [];
let powerupsAtivos = [];

let anguloNave = 0;
let pontuacao = 0;
let nivel = 1;
let jogoRodando = true;
let loopId;
let ultimoSpawn = 0;

// CONTROLE DE TIRO E MOUSE (NOVO)
let modoTiroAtual = 'padrao';
let timerPowerup = null;
let timerAlerta = null; //Controla o tempo de piscar
let mousePressionado = false; // Sabe se está segurando o clique
let ultimoTiro = 0; // Para controlar a velocidade da metralhadora

/* ==========================================
   FUNÇÕES AUXILIARES
   ========================================== */
function atualizarPlacar() {
    document.getElementById('placar-pontos').innerText = `PONTOS: ${pontuacao.toString().padStart(4, '0')}`;
    document.getElementById('placar-nivel').innerText = `NÍVEL: ${nivel}`;
}
//checagem do nivel e adicao de efeitos (apos aumentar nivel um efeito de brilho é ativado)
function checarProgresso() {
    const pontosParaUpar = 1000;
    const novoNivel = Math.floor(pontuacao / pontosParaUpar) + 1;
    if (novoNivel > nivel) {
        nivel = novoNivel;
        const placar = document.getElementById('placar-nivel');
        placar.classList.add('efeito-levelup');
        setTimeout(() => placar.classList.remove('efeito-levelup'), 1000);
        atualizarPlacar();
    }
}
//ativando a explosao dos Asteroids
function criarExplosao(x, y, cor, escala = 1) {
    const numParticulas = 15 * escala;
    for (let i = 0; i < numParticulas; i++) {
        const part = document.createElement('div');
        part.className = 'particula';
        part.style.backgroundColor = cor;
        document.body.appendChild(part);
        const angulo = Math.random() * Math.PI * 2;
        const velocidade = (Math.random() * 5 + 2) * escala;
        particulasAtivas.push({
            elemento: part, x: x, y: y,
            vx: Math.cos(angulo) * velocidade,
            vy: Math.sin(angulo) * velocidade,
            vida: 1.0
        });
    }
}

/* ==========================================
   POWER-UPS
   ========================================== */
function droparPowerup(x, y) {
    if (nivel < 2) return;
    //Se já tiver um Up ativo, NÃO dropa outro!
    //Se o modo de tiro não for o padrão (verde), cancela a função aqui mesmo.
    if (modoTiroAtual !== 'padrao') return; 
    const sorteio = Math.random();
    let tipoDrop = null;

    if (sorteio < UPGRADES.explosivo.chance) tipoDrop = 'explosivo';
    else if (sorteio < UPGRADES.cone.chance) tipoDrop = 'cone';
    else if (sorteio < UPGRADES.laser.chance) tipoDrop = 'laser';

    if (tipoDrop) {
        const dados = UPGRADES[tipoDrop];
        const el = document.createElement('div');
        el.className = 'powerup';
        el.style.backgroundColor = dados.cor;
        el.style.color = dados.cor;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        document.body.appendChild(el);

        const centroX = window.innerWidth / 2;
        const centroY = window.innerHeight / 2;
        const angulo = Math.atan2(centroY - y, centroX - x);
        const velocidade = 3;

        powerupsAtivos.push({
            elemento: el, x: x, y: y,
            vx: Math.cos(angulo) * velocidade,
            vy: Math.sin(angulo) * velocidade,
            tipo: tipoDrop, dados: dados
        });
    }
}

function ativarPowerup(tipo) {
    const dados = UPGRADES[tipo];
    const naveDiv = document.getElementById('nave');

    // 1. Limpa timers anteriores (caso pegue um powerup em cima de outro)
    if (timerPowerup) clearTimeout(timerPowerup);
    if (timerAlerta) clearTimeout(timerAlerta);

    // 2. Aplica o Power-up
    modoTiroAtual = tipo;
    naveDiv.className = ''; // Remove classes antigas (incluindo o alerta se houver)
    naveDiv.classList.add(dados.classeNave);

    // 3. Define quando deve começar a piscar (1.5 segundos antes de acabar)
    // Se o powerup durar menos de 1.5s, começa a piscar quase imediatamente
    const tempoParaAlerta = dados.tempo > 1500 ? dados.tempo - 1500 : 0;

    timerAlerta = setTimeout(() => {
        // Adiciona a classe que faz piscar (definida no CSS)
        naveDiv.classList.add('alerta-acabando');
    }, tempoParaAlerta);

    // 4. Define o fim do Power-up
    timerPowerup = setTimeout(() => {
        modoTiroAtual = 'padrao';
        
        // Remove todas as classes especiais (cor e pisca)
        naveDiv.className = 'nave-padrao'; 
        
        timerPowerup = null;
        timerAlerta = null;
    }, dados.tempo);
}

/* ==========================================
   TIROS
   ========================================== */
function criarBala(x, y, anguloGraus, cor, tipoTiro) {
    const laser = document.createElement("div");
    laser.className = "laser";
    laser.style.backgroundColor = cor;
    laser.style.boxShadow = `0 0 10px ${cor}`;
    document.body.appendChild(laser);

    const velocidade = 12;
    const radianos = (anguloGraus - 90) * (Math.PI / 180);

    lasersAtivos.push({
        elemento: laser, x: x, y: y,
        vx: Math.cos(radianos) * velocidade,
        vy: Math.sin(radianos) * velocidade,
        angulo: anguloGraus, tipo: tipoTiro
    });
}

function atirar() {
    if(!jogoRodando) return; 
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    if (modoTiroAtual === 'padrao') {
        criarBala(cx, cy, anguloNave, '#ff0000', 'normal');
    } 
    else if (modoTiroAtual === 'laser') {
        // Tiro rápido e branco (cadência controlada no loop)
        criarBala(cx, cy, anguloNave, '#ffffff', 'normal');
    }
    else if (modoTiroAtual === 'cone') {
        criarBala(cx, cy, anguloNave - 15, '#0000ff', 'normal');
        criarBala(cx, cy, anguloNave,      '#0000ff', 'normal');
        criarBala(cx, cy, anguloNave + 15, '#0000ff', 'normal');
    }
    else if (modoTiroAtual === 'explosivo') {
        criarBala(cx, cy, anguloNave, '#ff0000', 'nuclear');
    }
}

/* ==========================================
   GAME LOOP
   ========================================== */
function gameLoop(timestamp) {
    if (!jogoRodando) {
        atualizarParticulas(); 
        loopId = requestAnimationFrame(gameLoop);
        return;
    }

    // --- 1. METRALHADORA AUTOMÁTICA (AUTO-FIRE) ---
    // Se o mouse estiver apertado E o modo for Laser
    if (mousePressionado && modoTiroAtual === 'laser') {
        // 80ms = Super rápido (aprox 12 tiros por segundo)
        if (timestamp - ultimoTiro > 80) { 
            atirar();
            ultimoTiro = timestamp;
        }
    }

    // --- 2. SPAWN METEOROS ---
    const configAtual = CONFIG_NIVEIS[nivel] || CONFIG_NIVEIS['infinito'];
    if (timestamp - ultimoSpawn > configAtual.spawnRate) {
        if (meteorosAtivos.length < configAtual.maxMeteoros) {
            gerarMeteoro();
            ultimoSpawn = timestamp;
        }
    }

    const naveX = window.innerWidth / 2;
    const naveY = window.innerHeight / 2;
    const raioNave = 20;

    // --- 3. ATUALIZA METEOROS ---
    meteorosAtivos.forEach(obj => {
        obj.x += obj.vx; obj.y += obj.vy;
        if (obj.x > window.innerWidth + 100) obj.x = -100;
        if (obj.x < -100) obj.x = window.innerWidth + 100;
        if (obj.y > window.innerHeight + 100) obj.y = -100;
        if (obj.y < -100) obj.y = window.innerHeight + 100;
        obj.elemento.style.transform = `translate(${obj.x}px, ${obj.y}px)`;

        const dist = Math.hypot(obj.x + (obj.tamanho/2) - naveX, obj.y + (obj.tamanho/2) - naveY);
        if (dist < (obj.tamanho / 2) + raioNave) gameOver();
    });

    // --- 4. ATUALIZA POWERUPS ---
    for (let i = powerupsAtivos.length - 1; i >= 0; i--) {
        const p = powerupsAtivos[i];
        p.x += p.vx; p.y += p.vy;
        p.elemento.style.transform = `translate(${p.x}px, ${p.y}px)`;
        if (Math.hypot(p.x - naveX, p.y - naveY) < 30) {
            ativarPowerup(p.tipo);
            p.elemento.remove();
            powerupsAtivos.splice(i, 1);
        }
    }

    // --- 5. ATUALIZA LASERS ---
    for (let i = lasersAtivos.length - 1; i >= 0; i--) {
        const laser = lasersAtivos[i];
        let laserColidiu = false;
        laser.x += laser.vx; laser.y += laser.vy;

        // Verifica colisão com cada meteoro
        for (let j = meteorosAtivos.length - 1; j >= 0; j--) {
            const meteoro = meteorosAtivos[j];

            if (laser.x >= meteoro.x && laser.x <= meteoro.x + meteoro.tamanho &&
                laser.y >= meteoro.y && laser.y <= meteoro.y + meteoro.tamanho) {
                
                // --- CAMINHO 1: TIRO NUCLEAR (CORREÇÃO DO BUG) ---
                if (laser.tipo === 'nuclear') {
                    // Cria a onda visual
                    criarOndaChoque(meteoro.x, meteoro.y);
                    
                    // Destrói tudo (incluindo este meteoro que foi atingido)
                    destruirTudoAoRedor(meteoro.x, meteoro.y);
                    
                    // Remove o laser e PARA o loop deste laser imediatamente
                    // Isso impede que o código abaixo tente acessar um meteoro que já foi deletado
                    laser.elemento.remove();
                    lasersAtivos.splice(i, 1);
                    laserColidiu = true; // Marca como resolvido
                    break; 
                }

                // --- CAMINHO 2: TIRO NORMAL (Laser Branco/Azul/Verde Padrão) ---
                let dano = 1;
                if (modoTiroAtual === 'laser') dano = 0.5;

                meteoro.vida -= dano;
                laserColidiu = true;

                // Efeito visual de dano (Flash)
                meteoro.polygon.style.stroke = '#ffffff';
                setTimeout(() => { if(meteoro.elemento) meteoro.polygon.style.stroke = meteoro.corOriginal; }, 100);

                // Se o meteoro morreu
                if (meteoro.vida <= 0) {
                    if (meteoro.fragmenta) {
                        for(let k=0; k<3; k++) generatingMeteoro('verde', meteoro.x, meteoro.y, 30);
                    }
                    
                    droparPowerup(meteoro.x, meteoro.y);
                    criarExplosao(meteoro.x + meteoro.tamanho/2, meteoro.y + meteoro.tamanho/2, meteoro.corOriginal);
                    
                    meteoro.elemento.remove();
                    meteorosAtivos.splice(j, 1);
                    
                    pontuacao += meteoro.pontos;
                    atualizarPlacar();
                    checarProgresso();
                }
                
                // Se bateu (e não era nuclear), o laser some e paramos de verificar outros meteoros para este laser
                break; 
            }
        }

        // Se o laser não colidiu (e não foi removido pela lógica nuclear), verifica se saiu da tela
        if (!laserColidiu) {
            if (laser.x < 0 || laser.x > window.innerWidth || laser.y < 0 || laser.y > window.innerHeight) {
                laser.elemento.remove();
                lasersAtivos.splice(i, 1);
            } else {
                laser.elemento.style.transform = `translate(${laser.x}px, ${laser.y}px) rotate(${laser.angulo}deg)`;
            }
        }
    }

    atualizarParticulas();
    loopId = requestAnimationFrame(gameLoop);
}

// Funções de Efeitos
function criarOndaChoque(x, y) {
    const onda = document.createElement('div');
    onda.className = 'onda-choque';
    onda.style.width = '10px'; onda.style.height = '10px';
    onda.style.left = x + 'px'; onda.style.top = y + 'px';
    document.body.appendChild(onda);
    let tamanho = 10;
    const intervalo = setInterval(() => {
        tamanho += 20;
        onda.style.width = tamanho + 'px'; onda.style.height = tamanho + 'px';
        onda.style.opacity = 1 - (tamanho / 600);
        if (tamanho > 600) { clearInterval(intervalo); onda.remove(); }
    }, 16);
}

function destruirTudoAoRedor(origemX, origemY) {
    // Percorre de trás para frente para evitar erros ao remover
    for (let j = meteorosAtivos.length - 1; j >= 0; j--) {
        const m = meteorosAtivos[j];
        
        // Calcula distância da explosão
        const dist = Math.hypot(m.x - origemX, m.y - origemY);
        
        // Se estiver dentro do raio da explosão (300px)
        if (dist < 300) { 
            // 1. Efeitos Visuais
            criarExplosao(m.x, m.y, m.corOriginal);
            
            // 2. Pontos e Drops
            pontuacao += m.pontos;
            droparPowerup(m.x, m.y); // Chance de dropar item extra na explosão!

            // 3. Remove do HTML e do Array
            m.elemento.remove();
            meteorosAtivos.splice(j, 1);
            
            // 4. Atualiza progresso (para subir de nível na explosão)
            checarProgresso();
        }
    }
    atualizarPlacar();
}

// Geração de Meteoro (Mantendo compatibilidade)
function gerarMeteoro(tipoOpcional=null, xOpcional=null, yOpcional=null, tamanhoOpcional=null) {
    const configNivel = CONFIG_NIVEIS[nivel] || CONFIG_NIVEIS['infinito'];
    let chaveTipo = tipoOpcional || configNivel.tipos[Math.floor(Math.random() * configNivel.tipos.length)];
    const dadosTipo = TIPOS_METEOROS[chaveTipo];
    const divMeteoro = document.createElement("div");
    divMeteoro.className = "meteoro";
    const tamanho = tamanhoOpcional || Math.floor(Math.random() * 50) + 40; 
    divMeteoro.style.width = tamanho + "px"; divMeteoro.style.height = tamanho + "px";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.setAttribute("viewBox", "0 0 300 300");
    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("points", formasMeteoros[Math.floor(Math.random() * formasMeteoros.length)]);
    polygon.setAttribute("class", "linha-neon");
    polygon.style.stroke = dadosTipo.cor; 
    svg.appendChild(polygon); divMeteoro.appendChild(svg);
    document.getElementById("container-meteoros").appendChild(divMeteoro);
    let startX, startY;
    if (xOpcional!==null) { startX=xOpcional; startY=yOpcional; }
    else {
        if(Math.random()>0.5){ startX=Math.random()>0.5?-60:window.innerWidth+60; startY=Math.random()*window.innerHeight; }
        else{ startX=Math.random()*window.innerWidth; startY=Math.random()>0.5?-60:window.innerHeight+60; }
    }
    const dx = (window.innerWidth/2) - startX;
    const dy = (window.innerHeight/2) - startY;
    let angulo = Math.atan2(dy, dx);
    if(tipoOpcional) angulo += (Math.random()-0.5);
    const vel = (Math.random()*1.5+1)*configNivel.velocidade;
    meteorosAtivos.push({
        elemento: divMeteoro, polygon: polygon, tamanho: tamanho,
        x: startX, y: startY, vx: Math.cos(angulo)*vel, vy: Math.sin(angulo)*vel,
        vida: dadosTipo.vida, vidaMax: dadosTipo.vida, corOriginal: dadosTipo.cor,
        tipo: chaveTipo, fragmenta: dadosTipo.fragmenta, pontos: dadosTipo.pontos
    });
}
const generatingMeteoro = gerarMeteoro;

function gameOver() {
    jogoRodando = false; cancelAnimationFrame(loopId);
    criarExplosao(window.innerWidth/2, window.innerHeight/2, '#0f0'); 
    document.getElementById('nave').style.opacity = '0';
    document.getElementById('pontos-final').innerText = pontuacao;
    document.getElementById('tela-gameover').classList.remove('d-none');
}

function reiniciarJogo() {
    //reset de variáveis pontuacao, nivel, etc
    pontuacao = 0; nivel = 1; ultimoSpawn = 0; jogoRodando = true; modoTiroAtual = 'padrao';
    mousePressionado = false;
    
    // LIMPEZA DOS TIMERS DE POWERUP
    if (timerPowerup) clearTimeout(timerPowerup);
    if (timerAlerta) clearTimeout(timerAlerta); // time alert Up
    timerPowerup = null;
    timerAlerta = null;
    
    atualizarPlacar();
    document.getElementById('nave').style.opacity = '1';
    document.getElementById('nave').className = 'nave-padrao';
    
    meteorosAtivos.forEach(m => m.elemento.remove());
    lasersAtivos.forEach(l => l.elemento.remove());
    particulasAtivas.forEach(p => p.elemento.remove());
    powerupsAtivos.forEach(p => p.elemento.remove());
    
    meteorosAtivos = []; lasersAtivos = []; particulasAtivas = []; powerupsAtivos = [];
    document.getElementById('tela-gameover').classList.add('d-none');
    gameLoop(0);
}

function atualizarParticulas() {
    for (let i = particulasAtivas.length - 1; i >= 0; i--) {
        const p = particulasAtivas[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vida -= 0.02;
        if(p.vida <= 0) { p.elemento.remove(); particulasAtivas.splice(i, 1); }
        else { p.elemento.style.transform = `translate(${p.x}px, ${p.y}px)`; p.elemento.style.opacity = p.vida; }
    }
}

/* ==========================================
   EVENTOS
   ========================================== */
document.addEventListener('mousemove', (e) => {
    if(!jogoRodando) return;
    const dx = e.clientX - (window.innerWidth / 2);
    const dy = e.clientY - (window.innerHeight / 2);
    anguloNave = (Math.atan2(dy, dx) * (180 / Math.PI)) + 90;
    document.getElementById('nave').style.transform = `translate(-50%, -50%) rotate(${anguloNave}deg)`;
});

// EVENTOS DE MOUSE ATUALIZADOS PARA AUTO-FIRE
document.addEventListener('mousedown', (e) => {
    if(e.button === 0) {
        mousePressionado = true;
        // Se NÃO for laser, atira uma vez (tiro normal, cone ou explosivo)
        if (modoTiroAtual !== 'laser') {
            atirar();
        }
        // Se FOR laser, o gameLoop vai cuidar de atirar
    }
});

document.addEventListener('mouseup', () => {
    mousePressionado = false;
});

// INÍCIO
atualizarPlacar();
requestAnimationFrame(gameLoop);