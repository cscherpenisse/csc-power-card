class CscPowerCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._initialized = false;
    }

    setConfig(config) {
        this.config = config;
    }

    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    initialRender() {
        const groups = this.config.solar?.groups ?? [];
        const batteriesEnabled = this.config.battery?.show ?? false;
        const batteries = batteriesEnabled ? (this.config.battery?.list ?? []) : [];

        let currentYPos = 15;

        const flowBoxY = currentYPos + 5;
        const animStartPos = flowBoxY + 75;
        const houseYCenter = animStartPos + 50;

        let allPaths = '';
        let allLinesBg = '';
        let allLinesMove = '';
        let allDonuts = '';

        // 🌞 BASIS DONUTS
        allDonuts += this.renderDonutStatic(80, animStartPos, "#ff9800", "☀️", "Zon", "zon");
        allDonuts += this.renderDonutStatic(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis");
        allDonuts += this.renderDonutStatic(320, animStartPos, "#8353d1", "🔌", "Net", "net");

        // 🔋 BATTERIJEN
        const batteryY = houseYCenter + 120;
        const batteryStartX = 140;

        batteries.forEach((b, i) => {
            const x = batteryStartX + (i * 140);

            allDonuts += this.renderDonutStatic(
                x,
                batteryY,
                "#4caf50",
                "🔋",
                b.name,
                `bat_${i}`
            );

            const pathId = `path_bat_${i}`;
            const pathD = `
                M 200 ${houseYCenter + 25}
                L 200 ${batteryY - 40}
                L ${x} ${batteryY - 40}
                L ${x} ${batteryY - 18}
            `;

            allPaths += `<path id="${pathId}" d="${pathD}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_bat_${i}" href="#${pathId}" />`;
        });

        this.shadowRoot.innerHTML = `
        <ha-card>
            <style>
                .line-bg {
                    fill: none;
                    stroke: #333;
                    stroke-width: 2px;
                }

                .line-move {
                    stroke: #00ffcc;
                    stroke-width: 6;
                    stroke-linecap: round;
                    stroke-dasharray: 0.3, 100;
                    fill: none;
                    filter: drop-shadow(0px 0px 6px #00ffcc);
                    animation: flow 3s linear infinite;
                }

                .line-move.reverse {
                    animation-direction: reverse;
                }

                @keyframes flow {
                    from { stroke-dashoffset: 100; }
                    to { stroke-dashoffset: 0; }
                }

                text {
                    font-size: 12px;
                    fill: white;
                    font-family: sans-serif;
                }
            </style>

            <svg viewBox="0 0 800 ${batteryY + 100}">
                <defs>
                    ${allPaths}
                </defs>

                <g>${allLinesBg}</g>
                <g>${allLinesMove}</g>
                <g>${allDonuts}</g>
            </svg>
        </ha-card>
        `;

        this._initialized = true;
    }

    renderDonutStatic(x, y, color, icon, label, id) {
        return `
        <circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#444" stroke-width="5" />
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="18" fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="113" stroke-dashoffset="113"
            transform="rotate(-90 ${x} ${y})" />
        <text x="${x}" y="${y + 4}" text-anchor="middle">${icon}</text>
        <text x="${x + 25}" y="${y - 4}">${label}</text>
        <text id="val_${id}" x="${x + 25}" y="${y + 12}" fill="${color}">0</text>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        // 🔋 BATTERIJ UPDATE
        if (this.config.battery?.show) {
            (this.config.battery.list ?? []).forEach((b, i) => {
                const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
                const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

                const valEl = this.shadowRoot.getElementById(`val_bat_${i}`);
                if (valEl) {
                    valEl.textContent = `${Math.round(power)}W (${Math.round(soc)}%)`;
                }

                const moveEl = this.shadowRoot.getElementById(`move_bat_${i}`);
                if (moveEl) {
                    // zichtbaar bij vermogen
                    moveEl.style.visibility = Math.abs(power) > 5 ? 'visible' : 'hidden';

                    // richting (laden = negatief)
                    if (power < 0) {
                        moveEl.classList.add('reverse');
                    } else {
                        moveEl.classList.remove('reverse');
                    }
                }
            });
        }
    }
}

customElements.define("csc-power-card", CscPowerCard);
