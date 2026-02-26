export default class WebGLVisualizer {
    constructor(targetCanvas, analyser, getAudioData) {
        this.targetCanvas = targetCanvas;
        this.analyser = analyser;
        this.getAudioData = getAudioData;
        this.startTime = performance.now();

        this.gl = targetCanvas.getContext("webgl2") || targetCanvas.getContext("webgl");
        if (!this.gl) throw new Error("WebGL not supported");

        const vsSource = `
            attribute vec4 a_position;
            void main() { gl_Position = a_position; }
        `;

        const fsSource = `
            precision mediump float;
            uniform float u_time;
            uniform float u_bass;
            void main() {
                vec2 uv = gl_FragCoord.xy / vec2(${targetCanvas.width.toFixed(1)}, ${targetCanvas.height.toFixed(1)});
                float wave = sin(uv.x * 12.0 + u_time) * 0.5 + 0.5;
                vec3 color = mix(vec3(uv.y, wave, 1.0 - uv.y), vec3(1.0, 0.5, 0.0), u_bass);
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const createShader = (type, src) => {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, src);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS))
                console.error(this.gl.getShaderInfoLog(shader));
            return shader;
        };

        const vertexShader = createShader(this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(this.gl.FRAGMENT_SHADER, fsSource);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1
        ]), this.gl.STATIC_DRAW);

        this.posLoc = this.gl.getAttribLocation(this.program, "a_position");
        this.timeLoc = this.gl.getUniformLocation(this.program, "u_time");
        this.bassLoc = this.gl.getUniformLocation(this.program, "u_bass");

        this.gl.enableVertexAttribArray(this.posLoc);
        this.gl.vertexAttribPointer(this.posLoc, 2, this.gl.FLOAT, false, 0, 0);
    }

    update() {
        this.audioData = this.getAudioData();
    }

    draw() {
        const gl = this.gl;
        gl.viewport(0, 0, this.targetCanvas.width, this.targetCanvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.uniform1f(this.timeLoc, (performance.now() - this.startTime) * 0.002);
        gl.uniform1f(this.bassLoc, Math.min(this.audioData.bassEnergy / 150, 1.0));

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    destroy() {
        this.gl.deleteProgram(this.program);
    }
}
