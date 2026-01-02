/* ==========================================
   CONFIGURAÇÕES E DADOS
   ========================================== */
const TIPOS_METEOROS = {
    //Tipos de meteoros
    'verde':    { vida: 1, cor: '#00ff00', pontos: 100, fragmenta: false, velocidade: 1 }, 
    'azul':     { vida: 2, cor: '#0000ff', pontos: 200, fragmenta: false, velocidade: 0.7 }, 
    'vermelho': { vida: 4, cor: '#ff0000', pontos: 500, fragmenta: false, velocidade: 0.3 }, 
    'roxo':     { vida: 1, cor: '#800080', pontos: 300, fragmenta: true,  velocidade: 1 }  
};

const CONFIG_NIVEIS = {
    1: { maxMeteoros: 3,  spawnRate: 2000, velocidadeGlobal: .5, tipos: ['verde'] },
    2: { maxMeteoros: 5,  spawnRate: 1800, velocidadeGlobal: .5, tipos: ['verde', 'azul'] },
    3: { maxMeteoros: 7,  spawnRate: 1500, velocidadeGlobal: .5, tipos: ['verde', 'azul', 'roxo'] },
    4: { maxMeteoros: 10, spawnRate: 1200, velocidadeGlobal:  1, tipos: ['azul', 'vermelho', 'roxo'] },
    
    // Configuração base para o infinito (Nível 5+)
    'infinito': { maxMeteoros: 15, spawnRate: 800, velocidadeGlobal: 1 } 
};

//Porcentagem de aparecimento para Níveis 5+
const CHANCES_INFINITO = {
    'verde':    0.15, 
    'azul':     0.35, 
    'roxo':     0.30, 
    'vermelho': 0.20  
};

const UPGRADES = {
    'laser':     { cor: '#ffffff', classeNave: 'nave-branca', tempo: 5000, chance: 0.10 },
    'cone':      { cor: '#0000ff', classeNave: 'nave-azul',   tempo: 7000, chance: 0.05 },
    'explosivo': { cor: '#ff0000', classeNave: 'nave-vermelha', tempo: 4000, chance: 0.01 }
};

/* ==========================================
   VARIÁVEIS GLOBAIS
   ========================================== */
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
// NOVO: Variável para controlar o tempo do drop
let ultimoTempoDrop = 0;

// CONTROLE DE TIRO
let modoTiroAtual = 'padrao';
let timerPowerup = null;
let timerAlerta = null;
let mousePressionado = false;
let ultimoTiro = 0;

/* ==========================================
   FUNÇÕES AUXILIARES
   ========================================== */
function atualizarPlacar() {
    document.getElementById('placar-pontos').innerText = `PONTOS: ${pontuacao.toString().padStart(4, '0')}`;
    document.getElementById('placar-nivel').innerText = `NÍVEL: ${nivel}`;
}

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
    // 1. Regra de Nível (só após nível 2)
    if (nivel < 2) return;

    // 2. O Jogador já está usando um poder? Se sim, não dropa.
    if (modoTiroAtual !== 'padrao') return; 

    // 3. NOVA REGRA: Já tem uma bolinha caindo na tela?
    // Se a lista de powerups ativos não estiver vazia, cancela. 
    // Isso garante que só tenha 1 item na tela por vez.
    if (powerupsAtivos.length > 0) return;

    // 4. NOVA REGRA: Cooldown (Tempo de Espera)
    // Pega o horário atual em milissegundos
    const tempoAtual = Date.now();
    // Se passou menos de 5 segundos (5000ms) desde o último drop, cancela.
    if (tempoAtual - ultimoTempoDrop < 5000) return;

    // --- SORTEIO ---
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
        
        el.style.left = x + 'px'; 
        el.style.top = y + 'px';
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

        // ATUALIZA O RELÓGIO: Marca que acabou de cair um item
        ultimoTempoDrop = Date.now();
    }
}
function ativarPowerup(tipo) {
    const dados = UPGRADES[tipo];
    const naveDiv = document.getElementById('nave');
    const corpo = document.body; // Referência à tela inteira

    // 1. Limpeza de timers anteriores
    if (timerPowerup) clearTimeout(timerPowerup);
    if (timerAlerta) clearTimeout(timerAlerta);

    // 2. Aplica Power-up na NAVE
    modoTiroAtual = tipo;
    naveDiv.className = ''; 
    naveDiv.classList.add(dados.classeNave);

    // 3. Aplica Power-up na BORDA DA TELA (NOVO)
    // Injeta a cor do powerup na variável CSS que criamos
    corpo.style.setProperty('--cor-borda', dados.cor);
    corpo.classList.remove('alerta-borda'); // Garante que não está piscando
    corpo.classList.add('borda-ativa');     // Liga a luz da borda

    // 4. Configura o Alerta (Piscar)
    const tempoParaAlerta = dados.tempo > 1500 ? dados.tempo - 1500 : 0;
    
    timerAlerta = setTimeout(() => {
        naveDiv.classList.add('alerta-acabando'); // Nave pisca
        corpo.classList.add('alerta-borda');      // Tela pisca
    }, tempoParaAlerta);

    // 5. Configura o Fim do Efeito
    timerPowerup = setTimeout(() => {
        modoTiroAtual = 'padrao';
        
        // Reseta Nave
        naveDiv.className = 'nave-padrao'; 
        
        // Reseta Borda da Tela (NOVO)
        corpo.classList.remove('borda-ativa', 'alerta-borda');
        corpo.style.setProperty('--cor-borda', 'transparent');

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

    if (modoTiroAtual === 'padrao') criarBala(cx, cy, anguloNave, '#ff0000', 'normal');
    else if (modoTiroAtual === 'laser') criarBala(cx, cy, anguloNave, '#ffffff', 'normal');
    else if (modoTiroAtual === 'cone') {
        criarBala(cx, cy, anguloNave - 15, '#0000ff', 'normal');
        criarBala(cx, cy, anguloNave,      '#0000ff', 'normal');
        criarBala(cx, cy, anguloNave + 15, '#0000ff', 'normal');
    }
    else if (modoTiroAtual === 'explosivo') criarBala(cx, cy, anguloNave, '#ff0000', 'nuclear');
}

/* ==========================================
   GERAÇÃO DE METEORO
   ========================================== */
function gerarMeteoro(tipoOpcional=null, xOpcional=null, yOpcional=null, tamanhoOpcional=null) {
    
    // 1. Identifica Configuração do Nível
    const configNivel = CONFIG_NIVEIS[nivel] || CONFIG_NIVEIS['infinito'];
    
    // 2. SELEÇÃO DO TIPO DE METEORO
    let chaveTipo;

    if (tipoOpcional) {
        // Se forçado (ex: fragmentação), usa o tipo pedido
        chaveTipo = tipoOpcional;
    } 
    else if (nivel <= 4) {
        // NÍVEIS 1 A 4: Usa a lista fixa antiga (aleatório simples)
        const listaTipos = configNivel.tipos;
        chaveTipo = listaTipos[Math.floor(Math.random() * listaTipos.length)];
    } 
    else {
        // NÍVEL 5+ (INFINITO): Usa o SISTEMA DE PORCENTAGEM (Roleta)
        const sorteio = Math.random(); // Ex: 0.45
        let somaChance = 0;
        
        // Padrão caso algo falhe
        chaveTipo = 'verde'; 

        // Percorre as chances
        for (const [tipo, chance] of Object.entries(CHANCES_INFINITO)) {
            somaChance += chance;
            if (sorteio < somaChance) {
                chaveTipo = tipo;
                break;
            }
        }
    }
    
    const dadosTipo = TIPOS_METEOROS[chaveTipo];

    // 3. CRIAÇÃO VISUAL
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

    // 4. POSICIONAMENTO
    let startX, startY;
    if (xOpcional!==null) { startX=xOpcional; startY=yOpcional; }
    else {
        if(Math.random()>0.5){ startX=Math.random()>0.5?-60:window.innerWidth+60; startY=Math.random()*window.innerHeight; }
        else{ startX=Math.random()*window.innerWidth; startY=Math.random()>0.5?-60:window.innerHeight+60; }
    }

    // 5. CÁLCULO DE MOVIMENTO (COM VELOCIDADE INDIVIDUAL)
    const dx = (window.innerWidth/2) - startX;
    const dy = (window.innerHeight/2) - startY;
    let angulo = Math.atan2(dy, dx);
    if(tipoOpcional) angulo += (Math.random()-0.5); // Variação para fragmentos

    // FÓRMULA FINAL DE VELOCIDADE:
    // (Aleatório Base) * (Velocidade do Nível Global) * (Velocidade Individual do Tipo)
    const velocidadeFinal = (Math.random() * 1 + 1) * configNivel.velocidadeGlobal * dadosTipo.velocidade;

    meteorosAtivos.push({
        elemento: divMeteoro, polygon: polygon, tamanho: tamanho,
        x: startX, y: startY, 
        vx: Math.cos(angulo) * velocidadeFinal, 
        vy: Math.sin(angulo) * velocidadeFinal,
        vida: dadosTipo.vida, vidaMax: dadosTipo.vida, corOriginal: dadosTipo.cor,
        tipo: chaveTipo, fragmenta: dadosTipo.fragmenta, pontos: dadosTipo.pontos
    });
}
const generatingMeteoro = gerarMeteoro;

/* ==========================================
   GAME LOOP
   ========================================== */
function gameLoop(timestamp) {
    if (!jogoRodando) {
        atualizarParticulas(); 
        loopId = requestAnimationFrame(gameLoop);
        return;
    }

    if (mousePressionado && modoTiroAtual === 'laser') {
        if (timestamp - ultimoTiro > 80) { atirar(); ultimoTiro = timestamp; }
    }

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

    // Atualiza Meteoros
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

    // Atualiza Powerups
    for (let i = powerupsAtivos.length - 1; i >= 0; i--) {
        const p = powerupsAtivos[i];
        p.x += p.vx; p.y += p.vy;
        p.elemento.style.transform = `translate(${p.x}px, ${p.y}px)`;
        if (Math.hypot(p.x - naveX, p.y - naveY) < 30) {
            ativarPowerup(p.tipo);
            p.elemento.remove(); powerupsAtivos.splice(i, 1);
        }
    }

    // Atualiza Lasers
    for (let i = lasersAtivos.length - 1; i >= 0; i--) {
        const laser = lasersAtivos[i];
        let laserFoiDestruido = false; 

        laser.x += laser.vx; laser.y += laser.vy;

        for (let j = meteorosAtivos.length - 1; j >= 0; j--) {
            const meteoro = meteorosAtivos[j];
            if (laser.x >= meteoro.x && laser.x <= meteoro.x + meteoro.tamanho &&
                laser.y >= meteoro.y && laser.y <= meteoro.y + meteoro.tamanho) {
                
                // REMOVE ANTES DE PROCESSAR
                laser.elemento.remove(); lasersAtivos.splice(i, 1); laserFoiDestruido = true;    

                if (laser.tipo === 'nuclear') {
                    criarOndaChoque(meteoro.x, meteoro.y);
                    destruirTudoAoRedor(meteoro.x, meteoro.y);
                } else {
                    let dano = 1;
                    if (modoTiroAtual === 'laser') dano = 0.5;
                    meteoro.vida -= dano;

                    if (meteoro.polygon && meteoro.elemento) {
                        meteoro.polygon.style.stroke = '#ffffff';
                        setTimeout(() => { if(meteoro.elemento) meteoro.polygon.style.stroke = meteoro.corOriginal; }, 100);
                    }

                    if (meteoro.vida <= 0) {
                        if (meteoro.fragmenta) {
                            for(let k=0; k<3; k++) generatingMeteoro('verde', meteoro.x, meteoro.y, 30);
                        }
                        droparPowerup(meteoro.x, meteoro.y);
                        criarExplosao(meteoro.x + meteoro.tamanho/2, meteoro.y + meteoro.tamanho/2, meteoro.corOriginal);
                        meteoro.elemento.remove(); meteorosAtivos.splice(j, 1);
                        pontuacao += meteoro.pontos; atualizarPlacar(); checarProgresso();
                    }
                }
                break; 
            }
        }
        if (!laserFoiDestruido) {
            if (laser.x < 0 || laser.x > window.innerWidth || laser.y < 0 || laser.y > window.innerHeight) {
                laser.elemento.remove(); lasersAtivos.splice(i, 1);
            } else {
                laser.elemento.style.transform = `translate(${laser.x}px, ${laser.y}px) rotate(${laser.angulo}deg)`;
            }
        }
    }

    atualizarParticulas();
    loopId = requestAnimationFrame(gameLoop);
}

// Funções de Efeitos Globais
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
    for (let j = meteorosAtivos.length - 1; j >= 0; j--) {
        const m = meteorosAtivos[j];
        if (Math.hypot(m.x - origemX, m.y - origemY) < 300) { 
            criarExplosao(m.x, m.y, m.corOriginal);
            pontuacao += m.pontos;
            droparPowerup(m.x, m.y);
            m.elemento.remove(); meteorosAtivos.splice(j, 1);
            checarProgresso();
        }
    }
    atualizarPlacar();
}

function gameOver() {
    jogoRodando = false; cancelAnimationFrame(loopId);
    criarExplosao(window.innerWidth/2, window.innerHeight/2, '#0f0'); 
    document.getElementById('nave').style.opacity = '0';
    document.getElementById('pontos-final').innerText = pontuacao;
    document.getElementById('tela-gameover').classList.remove('d-none');
}

function reiniciarJogo() {
    cancelAnimationFrame(loopId);

    pontuacao = 0; 
    nivel = 1; 
    ultimoSpawn = 0; 
    ultimoTempoDrop = 0; 
    
    jogoRodando = true; 
    modoTiroAtual = 'padrao';
    mousePressionado = false;
    
    // Limpeza de Timers
    if (timerPowerup) clearTimeout(timerPowerup);
    if (timerAlerta) clearTimeout(timerAlerta); 
    timerPowerup = null;
    timerAlerta = null;
    
    // Reset Visual (Placar e Nave)
    atualizarPlacar();
    document.getElementById('nave').style.opacity = '1';
    document.getElementById('nave').className = 'nave-padrao';
    
    // --- LIMPEZA DA BORDA DA TELA (NOVO) ---
    document.body.classList.remove('borda-ativa', 'alerta-borda');
    document.body.style.setProperty('--cor-borda', 'transparent');
    
    // Limpeza de Objetos
    meteorosAtivos.forEach(m => m.elemento.remove());
    lasersAtivos.forEach(l => l.elemento.remove());
    particulasAtivas.forEach(p => p.elemento.remove());
    powerupsAtivos.forEach(p => p.elemento.remove());
    
    meteorosAtivos = []; 
    lasersAtivos = []; 
    particulasAtivas = []; 
    powerupsAtivos = [];
    
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

document.addEventListener('mousemove', (e) => {
    if(!jogoRodando) return;
    const dx = e.clientX - (window.innerWidth / 2);
    const dy = e.clientY - (window.innerHeight / 2);
    anguloNave = (Math.atan2(dy, dx) * (180 / Math.PI)) + 90;
    document.getElementById('nave').style.transform = `translate(-50%, -50%) rotate(${anguloNave}deg)`;
});

document.addEventListener('mousedown', (e) => {
    if(e.button === 0) {
        mousePressionado = true;
        if (modoTiroAtual !== 'laser') atirar();
    }
});
document.addEventListener('mouseup', () => { mousePressionado = false; });

atualizarPlacar();
requestAnimationFrame(gameLoop);

document.addEventListener('dblclick', function(event) {
    event.preventDefault();
}, { passive: false });