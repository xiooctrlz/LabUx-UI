/*
    CONTENIDOS EN EL JS:
        1. Banner web (parallax)
        2. Menú principal (opción activa)
        3. Logo 3D interactivo
        4. Imágenes que flotan con el cursor (foto de ojo de pez y fondo del banner)
        5. Carro que entra de izquierda a derecha (con humo)
        6. Discografía
        7. Galería de imágenes
        8. Botón ir arriba
        9. Videos de fondo
        10. Frase principal
*/


/* 1. Banner web (parallax) */
const capasParallax = document.querySelectorAll('[data-parallax]');
const banner = document.querySelector('.banner');
const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const tareasDeScroll = [];
let scrollProgramado = false;

function alDesplazarse(tarea) {
    tareasDeScroll.push(tarea);
}

window.addEventListener('scroll', () => {
    if (!scrollProgramado) {
        scrollProgramado = true;
        requestAnimationFrame(() => {
            scrollProgramado = false;
            tareasDeScroll.forEach((tarea) => tarea());
        });
    }
}, { passive: true });

function moverCapasParallax() {
    const scroll = window.scrollY;

    if (scroll > banner.offsetHeight) {
        return;
    }

    capasParallax.forEach((capa) => {
        const velocidad = parseFloat(capa.dataset.parallax);
        capa.style.transform = `translateY(${scroll * velocidad}px)`;
    });
}

if (!reducirMovimiento) {
    alDesplazarse(moverCapasParallax);
    moverCapasParallax();
}


/* 2. Menú principal */
const enlacesMenu = document.querySelectorAll('.btn-menu');

// 2.1 La estrella se queda en la opción de la sección que se está viendo
const secciones = [...enlacesMenu].map((enlace) => document.querySelector(enlace.getAttribute('href')));

const observadorSecciones = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
            enlacesMenu.forEach((enlace) => {
                const activo = enlace.getAttribute('href') === `#${entrada.target.id}`;
                enlace.classList.toggle('activo', activo);
                if (activo) {
                    enlace.setAttribute('aria-current', 'true');
                } else {
                    enlace.removeAttribute('aria-current');
                }
            });
        }
    });
}, { rootMargin: '-45% 0px -45% 0px' });

secciones.forEach((seccion) => {
    if (seccion) {
        observadorSecciones.observe(seccion);
    }
});


/* 3. Logo 3D interactivo (collar + físicas) */
async function iniciarLogo3D() {
    const contenedor = document.getElementById('logo-3d-contenedor');
    const canvas = document.getElementById('logo-3d-canvas');
    const respaldo = document.getElementById('logo-3d-respaldo');

    if (!contenedor || !canvas) {
        return;
    }

    try {
        const THREE = await import('three');
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');

        // 3.1 Medidas del collar
        const ANCHO_DIJE = 8.2;
        const MITAD_ANCLAJES = 7.7;      
        const ALTURA_ANCLAJES = 3.3;
        const ESLABONES = 47;            
        const LARGO_ESLABON = 0.38;      
        const ALTO_VISIBLE = 7;
        const ANCHO_MINIMO_VISIBLE = 10.4;

        // 3.2 Escena, cámara y luces
        const escena = new THREE.Scene();
        const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        const renderizador = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderizador.toneMapping = THREE.ACESFilmicToneMapping;
        renderizador.toneMappingExposure = 1.1;

        function crearEstudioMetalico() {
            const estudio = new THREE.Scene();
            estudio.background = new THREE.Color(0x060606);

            const lienzo = document.createElement('canvas');
            lienzo.width = 4;
            lienzo.height = 128;
            const pincel = lienzo.getContext('2d');
            const gradiente = pincel.createLinearGradient(0, 0, 0, 128);
            gradiente.addColorStop(0, '#ffffff');
            gradiente.addColorStop(0.55, '#7a7a7a');
            gradiente.addColorStop(1, '#101010');
            pincel.fillStyle = gradiente;
            pincel.fillRect(0, 0, 4, 128);
            const texturaDegradado = new THREE.CanvasTexture(lienzo);

            const panelDeLuz = (ancho, alto, intensidad, x, y, z, conDegradado = false) => {
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(intensidad, intensidad, intensidad),
                    map: conDegradado ? texturaDegradado : null,
                    side: THREE.DoubleSide
                });
                const panel = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), material);
                panel.position.set(x, y, z);
                panel.lookAt(0, 0, 0);
                estudio.add(panel);
            };

            panelDeLuz(16, 2.4, 16, 0, 7, 3);   
            panelDeLuz(1.8, 12, 10, -8, 1, 3);  
            panelDeLuz(1.8, 12, 10, 8, 1, 3);   
            panelDeLuz(12, 9, 8, 0, 1, 9, true);
            panelDeLuz(14, 1.6, 6, 0, -6, 4);   
            panelDeLuz(8, 5, 3, 0, 2, -9);      
            return estudio;
        }

        const generador = new THREE.PMREMGenerator(renderizador);
        escena.environment = generador.fromScene(crearEstudioMetalico(), 0.03).texture;

        const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.6);
        luzPrincipal.position.set(2, 3, 5);
        escena.add(luzPrincipal);

        // 3.3 Dije
        const modelo = await new FBXLoader().loadAsync('assets/modelo-3d/necklace-lngshot.fbx');
        const piezasDelDije = ['lngshot', 'fondo-cadena'];
        const sobrantes = [];

        modelo.traverse((parte) => {
            if (parte.isLight || (parte.isMesh && !piezasDelDije.includes(parte.name))) {
                sobrantes.push(parte);
            }
        });
        sobrantes.forEach((parte) => parte.parent.remove(parte));

        modelo.traverse((parte) => {
            if (parte.isMesh) {
                const esNombre = parte.name === 'lngshot';
                parte.material = new THREE.MeshStandardMaterial({
                    color: esNombre ? 0xffffff : 0x2b2b2b,
                    metalness: esNombre ? 0.85 : 1,
                    roughness: esNombre ? 0.22 : 0.38
                });
            }
        });

        modelo.rotation.x = Math.PI / 2;
        modelo.updateMatrixWorld(true);
        const tamanoOriginal = new THREE.Box3().setFromObject(modelo).getSize(new THREE.Vector3());
        modelo.scale.setScalar(ANCHO_DIJE / tamanoOriginal.x);
        modelo.updateMatrixWorld(true);

        const GROSOR_DIJE = 0.5;
        const grosorActual = new THREE.Box3().setFromObject(modelo).getSize(new THREE.Vector3()).z;
        modelo.scale.y *= GROSOR_DIJE / grosorActual;
        modelo.updateMatrixWorld(true);

        const cajaDije = new THREE.Box3().setFromObject(modelo);
        const cajaLetras = new THREE.Box3().setFromObject(modelo.getObjectByName('lngshot'));
        const puntoDeColgar = new THREE.Vector3((cajaLetras.min.x + cajaLetras.max.x) / 2, cajaLetras.max.y, cajaLetras.getCenter(new THREE.Vector3()).z);
        modelo.position.sub(puntoDeColgar);

        const BAJADA_DIJE = 0.3;
        modelo.position.y -= BAJADA_DIJE;

        const FRENTE_DEL_BROCHE = 0.16;
        modelo.position.z += FRENTE_DEL_BROCHE - (cajaDije.min.z - puntoDeColgar.z);

        const altoDije = cajaDije.max.y - cajaDije.min.y + BAJADA_DIJE;

        const dije = new THREE.Group();
        dije.add(modelo);

        // 3.4 Broche del dije
        const materialMetal = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 });

        const perfilBroche = new THREE.Shape();
        perfilBroche.moveTo(-0.22, -0.52);
        perfilBroche.lineTo(0.22, -0.52);
        perfilBroche.lineTo(0.29, 0.12);
        perfilBroche.bezierCurveTo(0.31, 0.36, 0.2, 0.5, 0, 0.5);
        perfilBroche.bezierCurveTo(-0.2, 0.5, -0.31, 0.36, -0.29, 0.12);
        perfilBroche.lineTo(-0.22, -0.52);

        const geometriaBroche = new THREE.ExtrudeGeometry(perfilBroche, {
            depth: 0.3,
            bevelEnabled: true,
            bevelThickness: 0.09,
            bevelSize: 0.07,
            bevelSegments: 8,
            curveSegments: 24
        });
        geometriaBroche.translate(0, 0, -0.15);

        const broche = new THREE.Mesh(geometriaBroche, materialMetal);
        broche.scale.set(0.55, 0.66, 0.6);
        dije.add(broche);

        // 3.5 Brillos
        const nombre = modelo.getObjectByName('lngshot');
        dije.updateMatrixWorld(true);
        const cajaNombre = new THREE.Box3().setFromObject(nombre);

        function crearTexturaBrillo() {
            const lado = 128;
            const lienzo = document.createElement('canvas');
            lienzo.width = lado;
            lienzo.height = lado;
            const pincel = lienzo.getContext('2d');
            const centro = lado / 2;

            const halo = pincel.createRadialGradient(centro, centro, 0, centro, centro, centro * 0.45);
            halo.addColorStop(0, 'rgba(255, 255, 255, 1)');
            halo.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
            halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
            pincel.fillStyle = halo;
            pincel.fillRect(0, 0, lado, lado);

            [[0, 1, 2.6], [Math.PI / 2, 1, 2.6], [Math.PI / 4, 0.5, 1.6], [-Math.PI / 4, 0.5, 1.6]].forEach(([angulo, largo, grosor]) => {
                pincel.save();
                pincel.translate(centro, centro);
                pincel.rotate(angulo);
                const degradado = pincel.createLinearGradient(-centro * largo, 0, centro * largo, 0);
                degradado.addColorStop(0, 'rgba(255, 255, 255, 0)');
                degradado.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
                degradado.addColorStop(1, 'rgba(255, 255, 255, 0)');
                pincel.fillStyle = degradado;
                pincel.beginPath();
                pincel.ellipse(0, 0, centro * largo, grosor, 0, 0, Math.PI * 2);
                pincel.fill();
                pincel.restore();
            });

            const textura = new THREE.CanvasTexture(lienzo);
            textura.colorSpace = THREE.SRGBColorSpace;
            return textura;
        }

        const texturaBrillo = crearTexturaBrillo();
        const brillos = [];
        for (let i = 0; i < 3; i++) {
            const material = new THREE.SpriteMaterial({
                map: texturaBrillo,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                toneMapped: false
            });
            const sprite = new THREE.Sprite(material);
            sprite.visible = false;
            dije.add(sprite);
            brillos.push({ sprite, activo: false, edad: 0, duracion: 1, tamano: 1, giro: 0 });
        }

        const rayoBrillo = new THREE.Raycaster();
        let esperaBrillo = 1.2;

        function encenderBrillo(brillo) {
            for (let intento = 0; intento < 12; intento++) {
                const x = cajaNombre.min.x + Math.random() * (cajaNombre.max.x - cajaNombre.min.x);
                const y = cajaNombre.min.y + Math.random() * (cajaNombre.max.y - cajaNombre.min.y);
                const origen = dije.localToWorld(new THREE.Vector3(x, y, 3));
                const destino = dije.localToWorld(new THREE.Vector3(x, y, 0));
                rayoBrillo.set(origen, destino.sub(origen).normalize());
                const impactos = rayoBrillo.intersectObject(nombre, true);
                if (impactos.length) {
                    const punto = dije.worldToLocal(impactos[0].point.clone());
                    brillo.sprite.position.set(punto.x, punto.y, punto.z + 0.15);
                    brillo.activo = true;
                    brillo.edad = 0;
                    brillo.duracion = 0.8 + Math.random() * 0.6;
                    brillo.tamano = (0.75 + Math.random() * 0.7) * (ANCHO_DIJE / 6.4);
                    brillo.giro = Math.random() * Math.PI;
                    brillo.sprite.visible = true;
                    return;
                }
            }
        }

        function animarBrillos(delta) {
            if (reducirMovimiento) {
                return;
            }

            esperaBrillo -= delta;
            if (esperaBrillo <= 0) {
                const libre = brillos.find((brillo) => !brillo.activo);
                if (libre) {
                    encenderBrillo(libre);
                }
                esperaBrillo = 0.5 + Math.random() * 1.6;
            }

            brillos.forEach((brillo) => {
                if (!brillo.activo) {
                    return;
                }
                brillo.edad += delta;
                const avance = brillo.edad / brillo.duracion;
                if (avance >= 1) {
                    brillo.activo = false;
                    brillo.sprite.visible = false;
                    return;
                }
                const pulso = Math.sin(Math.PI * avance);
                const tamano = brillo.tamano * (0.2 + 0.8 * pulso);
                brillo.sprite.scale.set(tamano, tamano, 1);
                brillo.sprite.material.opacity = pulso;
                brillo.sprite.material.rotation = brillo.giro + avance * 1.4;
            });
        }

        // 3.6 Cadena cubana de acero pulido
        function crearContornoOvalado(mitadLargo, mitadAncho) {
            const radio = mitadAncho;
            const recto = mitadLargo - radio;
            const contorno = new THREE.Path();
            contorno.moveTo(-recto, -radio);
            contorno.lineTo(recto, -radio);
            contorno.absarc(recto, 0, radio, -Math.PI / 2, Math.PI / 2, false);
            contorno.lineTo(-recto, radio);
            contorno.absarc(-recto, 0, radio, Math.PI / 2, Math.PI * 1.5, false);
            return contorno;
        }

        const GIRO_ESLABON = 0.45;
        const formaEslabon = new THREE.Shape(crearContornoOvalado(0.33, 0.19).getPoints(24));
        formaEslabon.holes.push(new THREE.Path(crearContornoOvalado(0.235, 0.105).getPoints(24)));
        const geometriaEslabon = new THREE.ExtrudeGeometry(formaEslabon, {
            depth: 0.06,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 3
        });
        geometriaEslabon.translate(0, 0, -0.03);
        const materialCadena = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 });
        const cadena = new THREE.InstancedMesh(geometriaEslabon, materialCadena, ESLABONES - 1);
        cadena.frustumCulled = false;

        const colgante = new THREE.Group();
        colgante.add(cadena);
        colgante.add(dije);
        escena.add(colgante);

        // 3.7 Física de la cadena
        const posX = new Float32Array(ESLABONES);
        const posY = new Float32Array(ESLABONES);
        const antX = new Float32Array(ESLABONES);
        const antY = new Float32Array(ESLABONES);
        const medio = (ESLABONES - 1) / 2;

        for (let i = 0; i < ESLABONES; i++) {
            const x = -MITAD_ANCLAJES + (i / (ESLABONES - 1)) * MITAD_ANCLAJES * 2;
            const y = ALTURA_ANCLAJES - 3.6 * (1 - (x / MITAD_ANCLAJES) ** 2);
            posX[i] = antX[i] = x;
            posY[i] = antY[i] = y;
        }

        const GRAVEDAD = -28;
        const AMORTIGUACION = 0.985;
        const PASO = 1 / 60;
        const VUELTAS_DE_AJUSTE = 50;
        const anclaje = { x: 0, y: 0, objetivoX: 0, objetivoY: 0 };
        const agarre = { nodo: -1, x: 0, y: 0 };    
        const limites = { minX: -10, maxX: 10, minY: -10, maxY: 10 };
        let tiempoSimulado = 0;

        // Dije como péndulo que cuelga de la argolla
        const pendulo = { angulo: 0, velocidad: 0 };
        let velocidadMedioAnterior = 0;

        const esFijo = (nodo) => nodo === 0 || nodo === ESLABONES - 1 || nodo === agarre.nodo;

        const VELOCIDAD_MAXIMA = 0.45; 

        function simularPaso() {
            tiempoSimulado += PASO;

            const respiro = reducirMovimiento ? 0 : Math.sin(tiempoSimulado * 0.9) * 0.08;
            anclaje.x += (anclaje.objetivoX - anclaje.x) * 0.07;
            anclaje.y += (anclaje.objetivoY - anclaje.y) * 0.07;

            for (let i = 1; i < ESLABONES - 1; i++) {
                if (i === agarre.nodo) {
                    continue;
                }
                const vx = Math.max(-VELOCIDAD_MAXIMA, Math.min(VELOCIDAD_MAXIMA, (posX[i] - antX[i]) * AMORTIGUACION));
                const vy = Math.max(-VELOCIDAD_MAXIMA, Math.min(VELOCIDAD_MAXIMA, (posY[i] - antY[i]) * AMORTIGUACION));
                antX[i] = posX[i];
                antY[i] = posY[i];
                posX[i] += vx;
                posY[i] += vy + GRAVEDAD * PASO * PASO;
            }

            if (agarre.nodo > 0) {
                antX[agarre.nodo] = posX[agarre.nodo];
                antY[agarre.nodo] = posY[agarre.nodo];
                posX[agarre.nodo] += (agarre.x - posX[agarre.nodo]) * 0.45;
                posY[agarre.nodo] += (agarre.y - posY[agarre.nodo]) * 0.45;
            }

            for (let vuelta = 0; vuelta < VUELTAS_DE_AJUSTE; vuelta++) {
                posX[0] = -MITAD_ANCLAJES + anclaje.x + respiro;
                posY[0] = ALTURA_ANCLAJES + anclaje.y;
                posX[ESLABONES - 1] = MITAD_ANCLAJES + anclaje.x + respiro;
                posY[ESLABONES - 1] = ALTURA_ANCLAJES + anclaje.y;

                for (let i = 0; i < ESLABONES - 1; i++) {
                    const dx = posX[i + 1] - posX[i];
                    const dy = posY[i + 1] - posY[i];
                    const distancia = Math.hypot(dx, dy) || 0.0001;
                    const correccion = (distancia - LARGO_ESLABON) / distancia;

                    const izquierdaFija = esFijo(i);
                    const derechaFija = esFijo(i + 1);
                    const parteIzquierda = izquierdaFija ? 0 : (derechaFija ? 1 : 0.5);
                    const parteDerecha = derechaFija ? 0 : (izquierdaFija ? 1 : 0.5);

                    posX[i] += dx * correccion * parteIzquierda;
                    posY[i] += dy * correccion * parteIzquierda;
                    posX[i + 1] -= dx * correccion * parteDerecha;
                    posY[i + 1] -= dy * correccion * parteDerecha;
                }
            }

            posY[medio] = Math.max(posY[medio], limites.minY + altoDije + 0.2);

            // Péndulo del dije
            const velocidadMedio = (posX[medio] - antX[medio]) / PASO;
            const aceleracionMedio = Math.max(-150, Math.min(150, (velocidadMedio - velocidadMedioAnterior) / PASO));
            velocidadMedioAnterior = velocidadMedio;

            pendulo.velocidad += (-11 * pendulo.angulo - 2 * pendulo.velocidad - 0.5 * aceleracionMedio) * PASO;
            pendulo.angulo += pendulo.velocidad * PASO;
            pendulo.angulo = Math.max(-0.4, Math.min(0.4, pendulo.angulo));
        }

        for (let i = 0; i < 300; i++) {
            simularPaso();
        }

        const auxiliar = new THREE.Object3D();
        auxiliar.rotation.order = 'ZXY';

        function dibujarCollar() {
            for (let i = 0; i < ESLABONES - 1; i++) {
                const dx = posX[i + 1] - posX[i];
                const dy = posY[i + 1] - posY[i];
                auxiliar.position.set((posX[i] + posX[i + 1]) / 2, (posY[i] + posY[i + 1]) / 2, 0);
                auxiliar.rotation.set(i % 2 === 0 ? GIRO_ESLABON : -GIRO_ESLABON, 0, Math.atan2(dy, dx));
                auxiliar.updateMatrix();
                cadena.setMatrixAt(i, auxiliar.matrix);
            }
            cadena.instanceMatrix.needsUpdate = true;

            dije.position.set(posX[medio], posY[medio], 0);
            dije.rotation.z = pendulo.angulo;
        }

        // 3.8 Cámara y tamaño
        const seccion = contenedor.parentElement;

        function ajustarTamano() {
            const ancho = contenedor.clientWidth;
            const alto = contenedor.clientHeight;
            const altoSeccion = seccion.clientHeight;
            renderizador.setSize(ancho, alto, false);
            camara.aspect = ancho / alto;

            const mitadAngulo = Math.tan(THREE.MathUtils.degToRad(30 / 2));
            const distancia = Math.max((ALTO_VISIBLE / 2) / mitadAngulo, (ANCHO_MINIMO_VISIBLE / 2) / (mitadAngulo * (ancho / altoSeccion)));
            const altoVisibleSeccion = 2 * distancia * mitadAngulo;
            const altoVisible = altoVisibleSeccion * (alto / altoSeccion);

            const unidadesPorPixel = altoVisibleSeccion / altoSeccion;
            const sobresaleArriba = seccion.getBoundingClientRect().top - contenedor.getBoundingClientRect().top;
            const sobresaleAbajo = alto - altoSeccion - sobresaleArriba;
            const centroY = ((sobresaleArriba - sobresaleAbajo) / 2) * unidadesPorPixel;

            camara.fov = THREE.MathUtils.radToDeg(2 * Math.atan(altoVisible / (2 * distancia)));
            camara.position.set(0, centroY, distancia);
            camara.lookAt(0, centroY, 0);
            camara.updateProjectionMatrix();

            const margen = 0.4;
            limites.maxY = centroY + altoVisible / 2 - margen;
            limites.minY = centroY - altoVisible / 2 + margen;
            limites.maxX = (altoVisible / 2) * camara.aspect - margen;
            limites.minX = -limites.maxX;
        }

        ajustarTamano();
        window.addEventListener('resize', ajustarTamano);

        // 3.9 El cursor mueve los extremos de la cadena y gira un poco todo el collar
        const giro = { x: 0, y: 0 };
        window.addEventListener('pointermove', (evento) => {
            if (reducirMovimiento) {
                return;
            }
            const relativoX = (evento.clientX / window.innerWidth) - 0.5;
            const relativoY = (evento.clientY / window.innerHeight) - 0.5;
            anclaje.objetivoX = relativoX * 1.6;
            anclaje.objetivoY = -relativoY * 0.5;
            giro.y = relativoX * 0.5;
            giro.x = relativoY * 0.2;
        }, { passive: true });

        // 3.10 Agarrar el collar
        const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const rayo = new THREE.Raycaster();
        const punteroNormalizado = new THREE.Vector2();
        const puntoEnEscena = new THREE.Vector3();

        function posicionEnElCollar(evento) {
            const caja = canvas.getBoundingClientRect();
            punteroNormalizado.set(
                ((evento.clientX - caja.left) / caja.width) * 2 - 1,
                -((evento.clientY - caja.top) / caja.height) * 2 + 1
            );
            colgante.updateMatrixWorld(true);
            rayo.setFromCamera(punteroNormalizado, camara);
            rayo.ray.intersectPlane(plano, puntoEnEscena);
            return colgante.worldToLocal(puntoEnEscena);
        }

        function nodoParaAgarrar(punto) {
            const sobreElDije = Math.abs(punto.x - posX[medio]) < ANCHO_DIJE / 2 && punto.y < posY[medio] + 0.5 && punto.y > posY[medio] - altoDije - 0.6;
            if (sobreElDije) {
                return medio;
            }

            let mejor = -1;
            let menorDistancia = 0.6 * 0.6;
            for (let i = 1; i < ESLABONES - 1; i++) {
                const distancia = (posX[i] - punto.x) ** 2 + (posY[i] - punto.y) ** 2;
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    mejor = i;
                }
            }
            return mejor;
        }

        function limitarAlcance(punto, nodo) {
            const extremos = [
                { x: -MITAD_ANCLAJES + anclaje.x, y: ALTURA_ANCLAJES + anclaje.y, alcance: nodo * LARGO_ESLABON * 0.97 },
                { x: MITAD_ANCLAJES + anclaje.x, y: ALTURA_ANCLAJES + anclaje.y, alcance: (ESLABONES - 1 - nodo) * LARGO_ESLABON * 0.97 }
            ];
            extremos.forEach((extremo) => {
                const dx = punto.x - extremo.x;
                const dy = punto.y - extremo.y;
                const distancia = Math.hypot(dx, dy);
                if (distancia > extremo.alcance) {
                    punto.x = extremo.x + (dx / distancia) * extremo.alcance;
                    punto.y = extremo.y + (dy / distancia) * extremo.alcance;
                }
            });
        }

        canvas.style.touchAction = 'pan-y';

        const cursorInicial = document.documentElement.style.cursor;
        const ponerCursor = (valor) => {
            document.documentElement.style.cursor = valor || cursorInicial;
        };

        function punteroLibreSobreElCollar(evento) {
            const caja = canvas.getBoundingClientRect();
            const dentro = evento.clientX >= caja.left && evento.clientX <= caja.right && evento.clientY >= caja.top && evento.clientY <= caja.bottom;
            if (!dentro) {
                return false;
            }
            const objetivo = evento.target;
            return !(objetivo instanceof Element && objetivo.closest('a, button, input, select, textarea, dialog, [role="button"]'));
        }

        window.addEventListener('pointerdown', (evento) => {
            if ((evento.pointerType === 'mouse' && evento.button !== 0) || !punteroLibreSobreElCollar(evento)) {
                return;
            }
            const punto = posicionEnElCollar(evento);
            const nodo = nodoParaAgarrar(punto);
            if (nodo < 0) {
                return;
            }
            agarre.nodo = nodo;
            punto.x = Math.max(limites.minX, Math.min(limites.maxX, punto.x));
            punto.y = Math.max(limites.minY, Math.min(limites.maxY, punto.y));
            limitarAlcance(punto, nodo);
            agarre.x = punto.x;
            agarre.y = punto.y;
            ponerCursor('grabbing');
            evento.preventDefault();
        });

        window.addEventListener('pointermove', (evento) => {
            if (agarre.nodo >= 0) {
                const punto = posicionEnElCollar(evento);
                punto.x = Math.max(limites.minX, Math.min(limites.maxX, punto.x));
                punto.y = Math.max(limites.minY, Math.min(limites.maxY, punto.y));
                limitarAlcance(punto, agarre.nodo);
                agarre.x = punto.x;
                agarre.y = punto.y;
            } else if (evento.pointerType === 'mouse') {
                ponerCursor(punteroLibreSobreElCollar(evento) && nodoParaAgarrar(posicionEnElCollar(evento)) >= 0 ? 'grab' : '');
            }
        });

        function soltar() {
            if (agarre.nodo >= 0) {
                agarre.nodo = -1;
                ponerCursor('');
            }
        }
        window.addEventListener('pointerup', soltar);
        window.addEventListener('pointercancel', soltar);
        window.addEventListener('blur', soltar);
        document.addEventListener('selectstart', (evento) => {
            if (agarre.nodo >= 0) {
                evento.preventDefault(); // mientras se arrastra el collar no se selecciona texto
            }
        });

        let visible = true;
        let animando = true;
        let ultimoCuadro = performance.now();
        let acumulado = 0;

        new IntersectionObserver((entradas) => {
            visible = entradas[0].isIntersecting;
            if (visible && !animando) {
                animando = true;
                ultimoCuadro = performance.now();
                requestAnimationFrame(animar);
            }
        }).observe(contenedor);

        function animar(ahora) {
            if (!visible) {
                animando = false;
                return;
            }
            requestAnimationFrame(animar);

            const delta = Math.min((ahora - ultimoCuadro) / 1000, 0.1);
            acumulado += delta;
            ultimoCuadro = ahora;
            while (acumulado >= PASO) {
                simularPaso();
                acumulado -= PASO;
            }

            colgante.rotation.y += (giro.y - colgante.rotation.y) * 0.06;
            colgante.rotation.x += (giro.x - colgante.rotation.x) * 0.06;
            dibujarCollar();
            animarBrillos(delta);
            renderizador.render(escena, camara);
        }
        requestAnimationFrame(animar);

        canvas.hidden = false;
        respaldo.hidden = true;
        dibujarCollar();
        ajustarTamano();

    } catch (error) {
        console.warn('No se pudo cargar el logo 3D, se muestra la imagen de respaldo.', error);
    }
}

function programarLogo3D() {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(iniciarLogo3D, { timeout: 2500 });
    } else {
        setTimeout(iniciarLogo3D, 800);
    }
}

if (document.readyState === 'complete') {
    programarLogo3D();
} else {
    window.addEventListener('load', programarLogo3D, { once: true });
}

/* 4. Imágenes que flotan con el cursor */
function activarFlotacion(imagen, zona, desplazamientoMaximo, escala) {
    if (!imagen || !zona || reducirMovimiento) {
        return;
    }

    const flotacion = { x: 0, y: 0, objetivoX: 0, objetivoY: 0, animando: false };

    function animar() {
        flotacion.x += (flotacion.objetivoX - flotacion.x) * 0.08;
        flotacion.y += (flotacion.objetivoY - flotacion.y) * 0.08;

        imagen.style.transform = `translate(${flotacion.x}px, ${flotacion.y}px) scale(${escala})`;

        const sigueMoviendose = Math.abs(flotacion.objetivoX - flotacion.x) > 0.05 || Math.abs(flotacion.objetivoY - flotacion.y) > 0.05;

        if (sigueMoviendose) {
            requestAnimationFrame(animar);
        } else {
            flotacion.animando = false;
            if (flotacion.objetivoX === 0 && flotacion.objetivoY === 0) {
                imagen.style.transform = '';
            }
        }
    }

    function iniciar() {
        if (!flotacion.animando) {
            flotacion.animando = true;
            requestAnimationFrame(animar);
        }
    }

    zona.addEventListener('pointermove', (evento) => {
        const caja = zona.getBoundingClientRect();
        const relativoX = ((evento.clientX - caja.left) / caja.width - 0.5) * 2;
        const relativoY = ((evento.clientY - caja.top) / caja.height - 0.5) * 2;

        flotacion.objetivoX = -relativoX * desplazamientoMaximo;
        flotacion.objetivoY = -relativoY * desplazamientoMaximo;
        iniciar();
    });

    zona.addEventListener('pointerleave', () => {
        flotacion.objetivoX = 0;
        flotacion.objetivoY = 0;
        iniciar();
    });
}

// 4.1 Foto de ojo de pez de la sección 소개
const fotoOjoDePez = document.querySelector('.sobre-el-grupo-foto');
activarFlotacion(fotoOjoDePez, fotoOjoDePez, 18, 1.025);

// 4.2 Fondo del banner
activarFlotacion(document.querySelector('.banner-fondo'), banner, 15, 1);

/* 5. Carro que entra de izquierda a derecha */
const carro = document.getElementById('carro-entra');

function moverCarro() {
    const seccion = carro.parentElement.getBoundingClientRect();
    const altoVentana = window.innerHeight;

    const progreso = Math.min(Math.max((altoVentana - seccion.top) / (altoVentana * 0.7), 0), 1);
    const desplazamiento = (1 - progreso) * -110;

    carro.style.transform = `translateX(${desplazamiento}%)`;
}

if (!reducirMovimiento) {
    alDesplazarse(moverCarro);
    window.addEventListener('resize', moverCarro);
    moverCarro();
}

// 5.1 Humo del carro
const humoCanvas = document.getElementById('humo-carro');

if (humoCanvas && carro && !reducirMovimiento) {
    const lienzo = humoCanvas.getContext('2d');
    const seccionCarro = carro.parentElement;
    const particulas = [];
    const aleatorio = (minimo, maximo) => minimo + Math.random() * (maximo - minimo);

    function crearBocanada(r, g, b) {
        const dibujo = document.createElement('canvas');
        dibujo.width = 64;
        dibujo.height = 64;
        const pincel = dibujo.getContext('2d');
        const degradado = pincel.createRadialGradient(32, 32, 0, 32, 32, 32);
        degradado.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
        degradado.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.55)`);
        degradado.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.2)`);
        degradado.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.05)`);
        degradado.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        pincel.fillStyle = degradado;
        pincel.fillRect(0, 0, 64, 64);
        return dibujo;
    }

    const bocanadas = [crearBocanada(232, 235, 242), crearBocanada(150, 156, 168)];

    let visibleHumo = false;
    let animandoHumo = false;
    let ultimoTiempoHumo = 0;
    let xAnterior = null;
    let velocidadCarro = 0;
    let pendienteDeEmitir = 0;

    function ajustarLienzoDelHumo() {
        humoCanvas.width = humoCanvas.clientWidth;
        humoCanvas.height = humoCanvas.clientHeight;
    }

    function salidaDelHumo() {
        const caja = carro.getBoundingClientRect();
        const lienzoCaja = humoCanvas.getBoundingClientRect();
        if (caja.width === 0 || caja.height === 0) {
            return null;
        }
        return {
            x: caja.left + caja.width * 0.2 - lienzoCaja.left,
            y: caja.top + caja.height * 0.86 - lienzoCaja.top,
            escala: caja.width / 1547 
        };
    }

    function nuevaBocanada(salida) {
        const e = salida.escala;
        const densa = Math.random() < 0.33;
        particulas.push({
            dibujo: bocanadas[Math.random() < 0.55 ? 0 : 1],
            x: salida.x + aleatorio(-14, 14) * e,
            y: salida.y + aleatorio(-22, 22) * e,
            vx: aleatorio(-150, -30) * e,       
            vy: aleatorio(-120, -10) * e,       
            radio: (densa ? aleatorio(14, 24) : aleatorio(22, 38)) * e,
            crecimiento: (densa ? aleatorio(35, 70) : aleatorio(60, 120)) * e,
            radioMaximo: (densa ? aleatorio(110, 170) : aleatorio(240, 340)) * e,
            edad: 0,
            duracion: densa ? aleatorio(4, 6.5) : aleatorio(5, 8),
            opacidad: densa ? aleatorio(0.32, 0.5) : aleatorio(0.22, 0.38),
            ondulacion: aleatorio(18, 50) * e,  
            fase: Math.random() * Math.PI * 2
        });
    }

    function animarHumo(ahora) {
        if (!visibleHumo) {
            animandoHumo = false;
            return;
        }
        requestAnimationFrame(animarHumo);

        const dt = Math.min((ahora - ultimoTiempoHumo) / 1000, 0.05);
        ultimoTiempoHumo = ahora;
        if (dt > 0) {
            avanzarHumo(dt);
        }
    }

    
    function avanzarHumo(dt) {
        const salida = salidaDelHumo();
        if (salida) {
            
            if (xAnterior !== null) {
                velocidadCarro += (((salida.x - xAnterior) / dt) - velocidadCarro) * 0.2;
            }
            xAnterior = salida.x;

            const salidaVisible = salida.x > -40 && salida.x < humoCanvas.width + 200;
            if (salidaVisible && particulas.length < 240) {
                pendienteDeEmitir += (10 + Math.min(Math.abs(velocidadCarro) / 14, 38)) * dt;
                while (pendienteDeEmitir >= 1) {
                    pendienteDeEmitir -= 1;
                    nuevaBocanada(salida);
                }
            }
        }

        lienzo.clearRect(0, 0, humoCanvas.width, humoCanvas.height);

        for (let i = particulas.length - 1; i >= 0; i--) {
            const p = particulas[i];
            p.edad += dt;
            if (p.edad >= p.duracion) {
                particulas.splice(i, 1);
                continue;
            }

            const vida = p.edad / p.duracion;
            p.vx *= 1 - 0.3 * dt;                                   
            p.vy -= 12 * dt;                                        
            p.x += p.vx * dt + Math.sin(p.edad * 1.3 + p.fase) * p.ondulacion * dt;          
            p.y += p.vy * dt + Math.cos(p.edad * 1.1 + p.fase * 1.7) * p.ondulacion * 0.6 * dt; 
            p.radio += p.crecimiento * (1 - p.radio / p.radioMaximo) * dt; 

            
            const opacidad = p.opacidad * Math.min(p.edad / 0.3, 1) * (1 - vida) ** 1.3;

            
            if (opacidad < 0.005 || p.x + p.radio < 0 || p.x - p.radio > humoCanvas.width || p.y + p.radio < 0 || p.y - p.radio > humoCanvas.height) {
                continue;
            }
            lienzo.globalAlpha = opacidad;
            lienzo.drawImage(p.dibujo, p.x - p.radio, p.y - p.radio, p.radio * 2, p.radio * 2);
        }
        lienzo.globalAlpha = 1;
    }

    
    new IntersectionObserver((entradas) => {
        visibleHumo = entradas[0].isIntersecting;
        if (visibleHumo) {
            ajustarLienzoDelHumo();
            if (!animandoHumo) {
                animandoHumo = true;
                ultimoTiempoHumo = performance.now();
                xAnterior = null;
                requestAnimationFrame(animarHumo);
            }
        } else {
            particulas.length = 0;
        }
    }).observe(seccionCarro);

    window.addEventListener('resize', ajustarLienzoDelHumo);
}


/* 6. Discografía */
const carrusel = document.getElementById('carrusel-albumes');
const albumes = [...carrusel.querySelectorAll('.album')];
const puntosAlbumes = [...carrusel.querySelectorAll('.punto')];
const estadoReproduccion = document.getElementById('estado-reproduccion');
let albumActual = 0;
let temporizadorDisco;

function posicionDelAlbum(indice) {
    const total = albumes.length;
    const mitad = Math.floor(total / 2);
    return ((indice - albumActual + total + mitad) % total) - mitad;
}

// 6.1 Audio de cada álbum
function audioDelAlbum(album) {
    return album.querySelector('.album-audio');
}

function actualizarEtiquetasAlbumes() {
    albumes.forEach((album, indice) => {
        const { nombreAlbum, cancion } = album.dataset;
        const sonando = !audioDelAlbum(album).paused;
        const portada = album.querySelector('.album-portada');

        if (sonando) {
            portada.setAttribute('aria-label', `Pausar la canción ${cancion} del álbum ${nombreAlbum}`);
        } else if (indice === albumActual) {
            portada.setAttribute('aria-label', `Reproducir la canción ${cancion} del álbum ${nombreAlbum}`);
        } else {
            portada.setAttribute('aria-label', `Ver el álbum ${nombreAlbum} y escuchar la canción ${cancion}`);
        }
    });
}

function detenerAudios() {
    albumes.forEach((album) => {
        const audio = audioDelAlbum(album);
        audio.pause();
        audio.currentTime = 0;
    });
}

function alternarAudio(album) {
    const audio = audioDelAlbum(album);

    if (audio.paused) {
        audio.play().catch((error) => {
            console.warn('No se pudo reproducir la canción.', error);
        });
    } else {
        audio.pause();
    }
}

albumes.forEach((album) => {
    const audio = audioDelAlbum(album);
    const { nombreAlbum, cancion } = album.dataset;

    audio.addEventListener('play', () => {
        album.classList.add('reproduciendo');
        estadoReproduccion.textContent = `Reproduciendo ${cancion}, del álbum ${nombreAlbum}`;
        actualizarEtiquetasAlbumes();
    });

    audio.addEventListener('pause', () => {
        album.classList.remove('reproduciendo');
        estadoReproduccion.textContent = audio.ended ? '' : `${cancion} en pausa`;
        actualizarEtiquetasAlbumes();
    });

    audio.addEventListener('ended', () => {
        album.classList.remove('reproduciendo');
        estadoReproduccion.textContent = '';
        actualizarEtiquetasAlbumes();
    });
});

// 6.2 Posición de los álbumes
function mostrarAlbum(nuevoAlbum, reproducir = false) {
    albumActual = nuevoAlbum;
    clearTimeout(temporizadorDisco);
    detenerAudios();

    albumes.forEach((album, indice) => {
        const posicion = posicionDelAlbum(indice);
        const visible = Math.abs(posicion) <= 1;
        const portada = album.querySelector('.album-portada');

        album.dataset.pos = posicion;
        album.classList.remove('disco-abierto');
        album.setAttribute('aria-hidden', visible ? 'false' : 'true');
        portada.tabIndex = visible ? 0 : -1;
    });

    puntosAlbumes.forEach((punto, indice) => {
        punto.classList.toggle('activo', indice === albumActual);
        if (indice === albumActual) {
            punto.setAttribute('aria-current', 'true');
        } else {
            punto.removeAttribute('aria-current');
        }
    });

    actualizarEtiquetasAlbumes();

    temporizadorDisco = setTimeout(() => {
        albumes[albumActual].classList.add('disco-abierto');
    }, 800);

    if (reproducir) {
        alternarAudio(albumes[albumActual]);
    }
}

// 6.3 Interacciones
albumes.forEach((album, indice) => {
    album.querySelector('.album-portada').addEventListener('click', () => {
        if (indice !== albumActual) {
            mostrarAlbum(indice, true);  
        } else {
            alternarAudio(album);        
        }
    });
});

puntosAlbumes.forEach((punto, indice) => {
    punto.addEventListener('click', () => {
        if (indice !== albumActual) {
            mostrarAlbum(indice, true);
        }
    });
});

carrusel.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowRight') {
        mostrarAlbum((albumActual + 1) % albumes.length);
    } else if (evento.key === 'ArrowLeft') {
        mostrarAlbum((albumActual - 1 + albumes.length) % albumes.length);
    }
});

mostrarAlbum(0);

/* 7. Galería de imágenes */
const galeria = document.getElementById('galeria-slides');
const paginasGaleria = [...galeria.querySelectorAll('.galeria-slide')];
const puntosGaleria = [...galeria.querySelectorAll('.punto')];
const imagenAmpliada = document.getElementById('galeria-ampliada');
const imagenAmpliadaImg = document.getElementById('galeria-ampliada-img');

// 7.1 Páginas de la galería (cada una con una cuadrícula distinta)
function mostrarPaginaGaleria(nuevaPagina) {
    paginasGaleria.forEach((pagina, indice) => {
        const activa = indice === nuevaPagina;
        pagina.classList.toggle('activo', activa);
        pagina.setAttribute('aria-hidden', activa ? 'false' : 'true');
        pagina.querySelectorAll('button').forEach((boton) => {
            boton.tabIndex = activa ? 0 : -1;
        });
    });

    puntosGaleria.forEach((punto, indice) => {
        punto.classList.toggle('activo', indice === nuevaPagina);
        if (indice === nuevaPagina) {
            punto.setAttribute('aria-current', 'true');
        } else {
            punto.removeAttribute('aria-current');
        }
    });
}

puntosGaleria.forEach((punto, indice) => {
    punto.addEventListener('click', () => mostrarPaginaGaleria(indice));
});

mostrarPaginaGaleria(0);

// 7.1.1 Hover de cada foto
const fotosGaleria = [...galeria.querySelectorAll('.galeria-foto')];

const lados = fotosGaleria.map((foto, indice) => (indice % 2 === 0 ? -1 : 1));
for (let i = lados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lados[i], lados[j]] = [lados[j], lados[i]];
}

fotosGaleria.forEach((foto, indice) => {
    const grados = 1.8 + Math.random() * 1.4;
    foto.style.setProperty('--giro-foto', `${lados[indice] * grados}deg`);
});

// 7.2 Imagen ampliada
galeria.querySelectorAll('.galeria-foto').forEach((foto) => {
    foto.addEventListener('click', () => {
        imagenAmpliadaImg.src = foto.dataset.imagen;
        imagenAmpliadaImg.alt = foto.dataset.descripcion;
        imagenAmpliada.showModal();
    });
});

imagenAmpliada.addEventListener('click', (evento) => {
    if (evento.target !== imagenAmpliadaImg) {
        imagenAmpliada.close();
    }
});


/* 8. Botón ir arriba */
const botonArriba = document.querySelector('.ir-arriba');
const bloquesFooter = [...document.querySelectorAll('.footer-informacion > *')];
let distanciaBase = 0;

function medirDistanciaBase() {
    botonArriba.style.removeProperty('bottom');
    distanciaBase = parseFloat(getComputedStyle(botonArriba).bottom);
}

function acomodarBotonArriba() {
    if (window.scrollY > 100) {
        botonArriba.classList.add('show');
    } else {
        botonArriba.classList.remove('show');
    }

    const limiteSuperior = Math.min(...bloquesFooter.map((bloque) => bloque.getBoundingClientRect().top));
    const espacioOcupado = window.innerHeight - limiteSuperior + 24;
    botonArriba.style.bottom = `${Math.max(distanciaBase, espacioOcupado)}px`;
}

medirDistanciaBase();
acomodarBotonArriba();

alDesplazarse(acomodarBotonArriba);
window.addEventListener('resize', () => {
    medirDistanciaBase();
    acomodarBotonArriba();
});

botonArriba.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});


/* 9. Videos de fondo */
const videosDeFondo = [...document.querySelectorAll('video[preload="none"]')];

if (videosDeFondo.length && 'IntersectionObserver' in window && !reducirMovimiento) {
    const observadorVideos = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
            const video = entrada.target.querySelector('video[preload="none"]');
            if (entrada.isIntersecting) {
                video.play().catch(() => {
                });
            } else {
                video.pause();
            }
        });
    }, { rootMargin: '300px 0px' });

    videosDeFondo.forEach((video) => {
        const zona = video.closest('.cita-video, .footer-video') || video.parentElement;
        observadorVideos.observe(zona);
    });
}

/* 10. Cambio de tipografía */
const INTERVALO_TIPOGRAFIA = 300;

const acentoFrase = document.querySelector('.cita-principal .fuente-acento');
const tipografiasUrbanas = [
    { familia: '"Sedgwick Ave Display"', escala: 1 },
    { familia: '"Permanent Marker"', escala: 0.92 },
    { familia: 'Knewave', escala: 0.95 },
    { familia: '"Rock Salt"', escala: 0.85 },
    { familia: '"Londrina Sketch"', escala: 1.05 },
];

if (acentoFrase && !reducirMovimiento && document.fonts) {
    const textoAcento = acentoFrase.textContent;
    const parrafoFrase = acentoFrase.parentElement;
    const alturaMaxima = parrafoFrase.offsetHeight * 1.3; 

    Promise.all(tipografiasUrbanas.map((tipografia) => {
        return document.fonts.load(`1em ${tipografia.familia}`, textoAcento)
            .then((cargadas) => (cargadas.length ? tipografia : null))
            .catch(() => null);
    })).then((resultado) => {
        const disponibles = resultado.filter(Boolean);
        if (disponibles.length < 2) {
            return;
        }

        function calcularEscalas() {
            const familiaActual = acentoFrase.style.fontFamily;
            const tamanoActual = acentoFrase.style.fontSize;
            disponibles.forEach((tipografia) => {
                let escala = tipografia.escala;
                acentoFrase.style.fontFamily = `${tipografia.familia}, cursive`;
                acentoFrase.style.fontSize = `${escala}em`;
                for (let intentos = 0; parrafoFrase.offsetHeight > alturaMaxima && escala > 0.5 && intentos < 14; intentos++) {
                    escala -= 0.04;
                    acentoFrase.style.fontSize = `${escala.toFixed(2)}em`;
                }
                tipografia.escalaFinal = escala;
            });
            acentoFrase.style.fontFamily = familiaActual;
            const actual = disponibles.find((tipografia) => familiaActual === `${tipografia.familia}, cursive`);
            acentoFrase.style.fontSize = actual ? `${actual.escalaFinal}em` : tamanoActual;
        }

        calcularEscalas();

        let temporizadorResize;
        window.addEventListener('resize', () => {
            clearTimeout(temporizadorResize);
            temporizadorResize = setTimeout(calcularEscalas, 250);
        });

        let indice = 0;
        let temporizadorCambio = null;

        function cambiarTipografia() {
            let siguiente = indice;
            while (siguiente === indice) {
                siguiente = Math.floor(Math.random() * disponibles.length);
            }
            indice = siguiente;
            acentoFrase.style.fontFamily = `${disponibles[indice].familia}, cursive`;
            acentoFrase.style.fontSize = `${disponibles[indice].escalaFinal}em`;
        }

        function empezarACambiar() {
            if (!temporizadorCambio) {
                cambiarTipografia();
                temporizadorCambio = setInterval(cambiarTipografia, INTERVALO_TIPOGRAFIA);
            }
        }

        function dejarDeCambiar() {
            clearInterval(temporizadorCambio);
            temporizadorCambio = null; // la tipografía en la que quedó se mantiene
        }

        function sobreLaFrase(evento) {
            const margen = 6;
            return [...acentoFrase.getClientRects()].some((caja) => (
                evento.clientX >= caja.left - margen && evento.clientX <= caja.right + margen &&
                evento.clientY >= caja.top - margen && evento.clientY <= caja.bottom + margen
            ));
        }

        window.addEventListener('pointermove', (evento) => {
            if (evento.pointerType === 'touch') {
                return;
            }
            if (sobreLaFrase(evento)) {
                empezarACambiar();
            } else {
                dejarDeCambiar();
            }
        }, { passive: true });

        window.addEventListener('pointerdown', (evento) => {
            if (evento.pointerType === 'touch' && sobreLaFrase(evento)) {
                empezarACambiar();
            }
        }, { passive: true });

        window.addEventListener('pointerup', dejarDeCambiar);
        window.addEventListener('pointercancel', dejarDeCambiar);
        window.addEventListener('blur', dejarDeCambiar);
        document.documentElement.addEventListener('mouseleave', dejarDeCambiar);
    });
}