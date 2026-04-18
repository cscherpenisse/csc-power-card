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

    // ✅ FIX: veilige state reader
    getState(entity) {
        if (!entity) return 0;
        const stateObj = this._hass.states[entity];
        if (!stateObj) return 0;

        const val = parseFloat(stateObj.state);
        return isNaN(val) ? 0 : val;
    }

    initialRender() {
        const batteries = this.config.battery?.list ?? [];

        const houseY = 180;
        const solarY = 100;
        const gridY = 100;

        let paths = '';
        let linesBg = '';
        let linesMove = '';
        let donuts = '';

        // =====================
        // 🔋 BATTERIJEN
        // =====================
        const batY = houseY - 80;
        const batX = [160, 240];

        batteries.forEach((b, i) => {
            const x = batX[i] || 200;

            donuts += this.renderDonut(x, batY, "#4caf50", "🔋", b.name, `bat_${i}`);

            // Huis ↔ batterij
            const p1 = `path_huis_bat_${i}`;
            paths += `<path id="${p1}" d="M200 ${houseY} L200 ${batY+20} L${x} ${batY+20} L${x} ${batY}" />`;
            linesBg += `<use class="line-bg" href="#${p1}" />`;
            linesMove += `<use class="line-move" id="move_huis_bat_${i}" href="#${p1}" />`;

            // Zon → batterij
            const p2 = `path_zon_bat_${i}`;
            paths += `<path id="${p2}" d="M80 ${solarY} L80 ${batY} L${x} ${batY}" />`;
            linesBg += `<use class="line-bg" href="#${p2}" />`;
            linesMove += `<use class="line-move" id="move_zon_bat_${i}" href="#${p2}" />`;

            // Net → batterij
            const p3 = `path_net_bat_${i}`;
            paths += `<path id="${p3}" d="M320 ${gridY} L320 ${batY} L${x} ${batY}" />`;
            linesBg += `<use class="line-bg" href="#${p3}" />`;
            linesMove += `<use class="line-move" id="move_net_bat_${i}" href="#${p3}" />`;
        });

        // =====================
        // BASIS PADEN
        // =====================
        paths += `<path id="path_zon_huis" d="M80 ${solarY} L80 ${houseY} L200 ${houseY}" />`;
        paths += `<path id="path_huis_net" d="M200 ${houseY} L320 ${houseY} L320 ${gridY}" />`;

        this.shadowRoot.innerHTML = `
        <style>
            .line-bg {
                stroke:#444;
                stroke-width:2;
                fill:none;
            }

            .line-move {
                stroke:#00e5ff;
                stroke-width:5;
                stroke-linecap:round;
                stroke-dasharray:0.5, 12;
                animation: flow 2s linear infinite;
                filter: drop-shadow(0 0 5px #00e5ff);
            }

            .reverse {
                animation-direction: reverse;
            }

            @keyframes flow {
                from { stroke-dashoffset: 50; }
                to { stroke-dashoffset: 0; }
            }
        </style>

        <ha-card>
        <svg viewBox="0 0 400 260">

            <defs>${paths}</defs>

            <g>${linesBg}</g>

            <g>
                ${linesMove}
                <use class="line-move" id="move_zon" href="#path_zon_huis"/>
                <use class="line-move" id="move_net" href="#path_huis_net"/>
            </g>

            <g>
                ${donuts}
                ${this.renderDonut(80, ${solarY}, "#ff9800", "☀️", "Zon", "zon")}
                ${this.renderDonut(200, ${houseY}, "#2196f3", "🏠", "Huis", "huis")}
                ${this.renderDonut(320, ${gridY}, "#9c27b0", "🔌", "Net", "net")}
            </g>

        </svg>
        </ha-card>
        `;

        this._initialized = true;
    }

    renderDonut(x, y, color, icon, label, id) {
        return `
        <g>
            <circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#333" stroke-width="4"/>
            <circle id="ring_${id}" cx="${x}" cy="${y}" r="18"
                fill="none" stroke="${color}" stroke-width="4"
                stroke-dasharray="113" stroke-dashoffset="113"
                transform="rotate(-90 ${x} ${y})"/>
            <text x="${x}" y="${y+5}" text-anchor="middle">${icon}</text>
            <text x="${x+25}" y="${y-4}" fill="#ccc">${label}</text>
            <text id="val_${id}" x="${x+25}" y="${y+12}" fill="${color}">0W</text>
        </g>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        // ✅ FIXED DATA
        const solar = this.getState(this.config.solar?.gateway?.entity);
        const grid = this.getState(this.config.grid?.entity);
        const home = solar + grid;

        // =====================
        // UPDATE BASIS
        // =====================
        this.setText("zon", solar);
        this.setText("net", grid);
        this.setText("huis", home);

        this.toggleFlow("move_zon", solar > 5, false);
        this.toggleFlow("move_net", Math.abs(grid) > 5, grid > 0);

        // =====================
        // 🔋 BATTERIJEN
        // =====================
        (this.config.battery?.list ?? []).forEach((b, i) => {
            const power = this.getState(b.power);
            const soc = this.getState(b.soc);

            const el = this.shadowRoot.getElementById(`val_bat_${i}`);
            if (el) el.textContent = `${Math.round(power)}W (${Math.round(soc)}%)`;

            // Huis ↔ batterij
            this.toggleFlow(`move_huis_bat_${i}`, Math.abs(power) > 5, power < 0);

            // Zon → batterij
            this.toggleFlow(`move_zon_bat_${i}`, solar > 5, false);

            // Net → batterij
            this.toggleFlow(`move_net_bat_${i}`, Math.abs(grid) > 5, false);
        });
    }

    setText(id, val) {
        const el = this.shadowRoot.getElementById(`val_${id}`);
        if (el) el.textContent = `${Math.round(val)}W`;
    }

    toggleFlow(id, show, reverse) {
        const el = this.shadowRoot.getElementById(id);
        if (!el) return;

        el.style.visibility = show ? "visible" : "hidden";
        el.classList.toggle("reverse", reverse);
    }
}

customElements.define("csc-power-card", CscPowerCard);
