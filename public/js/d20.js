// A CSS 3D icosahedron (d20) that behaves like the die floating inside a
// Magic 8 Ball: it sinks into the murk while the ball is shaken, then rises
// with one chosen face pressed flat against the window.
//
// Faces are plain <div>s clipped to triangles and placed with matrix3d().
// Geometry uses CSS axes: x right, y down, z toward the viewer.

const PHI = (1 + Math.sqrt(5)) / 2;

export const FACE_COUNT = 20;

// Face text size as a fraction of the edge, by line count. fitText() shrinks
// from here until every line clears the triangle's slanted sides.
const FONT_BY_LINES = [0.16, 0.088, 0.082, 0.07];
const MIN_FONT = 0.045;
const SIDE_CLEARANCE = 0.04;
const BASE_CLEARANCE = 0.05;

const SUNK = { scale: "0.62", filter: "blur(3px) brightness(0.35)", opacity: "0.85" };
const RISEN = { scale: "1", filter: "blur(0px) brightness(1)", opacity: "1" };

const MAX_TILT_DEG = 8;

// `labels` holds one entry per face: the lines of text printed on it.
export function createD20(root, labels, { reducedMotion }) {
  const frames = icosahedronFaceFrames();

  const stage = element("div", "die-stage");
  const die = element("div", "die");
  const faces = frames.map((frame) => {
    const face = element("div", "face");
    face.style.transform = `${frame.matrix} translateZ(var(--inradius))`;
    face.append(element("div", "face-text"));
    return face;
  });
  die.append(...faces);
  stage.append(die);
  root.append(stage);
  relabel(labels);

  // Faces must be in the document first: fitting measures their layout.
  function relabel(nextLabels) {
    if (nextLabels.length !== FACE_COUNT) {
      throw new Error(`A d20 needs ${FACE_COUNT} labels, got ${nextLabels.length}.`);
    }
    faces.forEach((face, i) => {
      face.firstElementChild.replaceChildren(...nextLabels[i].map((line) => element("span", null, line)));
      fitText(face, nextLabels[i].length);
    });
  }

  let orientation = randomOrientation();
  die.style.transform = orientation.toString();
  Object.assign(root.style, SUNK);
  shadeFaces(orientation);

  let shadingFrame = 0;

  // Faces are lit by how squarely they face the window; the steep falloff
  // keeps only the face pressed against the glass bright.
  function shadeFaces(matrix) {
    frames.forEach((frame, i) => {
      const facing = matrix.transformPoint(new DOMPoint(...frame.normal, 0)).z;
      const shade = 0.94 * (1 - Math.max(0, facing) ** 4);
      faces[i].style.setProperty("--shade", shade.toFixed(3));
    });
  }

  // Re-shade every frame while the die tumbles, so faces darken as they turn
  // away from the window and brighten as they turn toward it.
  function trackShading(animation) {
    cancelAnimationFrame(shadingFrame);
    const tick = () => {
      shadeFaces(new DOMMatrix(getComputedStyle(die).transform));
      if (animation.playState === "running") {
        shadingFrame = requestAnimationFrame(tick);
      }
    };
    shadingFrame = requestAnimationFrame(tick);
    animation.finished.then(() => shadeFaces(orientation), () => {});
  }

  function spinTo(target, { duration, easing }) {
    const from = orientation;
    orientation = target;
    die.style.transform = target.toString();
    if (reducedMotion()) {
      shadeFaces(target);
      return Promise.resolve();
    }
    // One full turn about a random axis on top of the from→target rotation
    // turns a straight slerp into a tumble; 360deg keeps the end state exact.
    const axis = randomAxis().map((n) => n.toFixed(4)).join(", ");
    const animation = die.animate(
      [
        { transform: `rotate3d(${axis}, 0deg) ${from}` },
        { transform: `rotate3d(${axis}, 360deg) ${target}` },
      ],
      { duration, easing },
    );
    trackShading(animation);
    return animation.finished.catch(() => {});
  }

  function animateDepth(to, options) {
    const computed = getComputedStyle(root);
    const from = Object.fromEntries(Object.keys(to).map((prop) => [prop, computed[prop]]));
    Object.assign(root.style, to);
    if (reducedMotion()) {
      return Promise.resolve();
    }
    return root.animate([from, to], options).finished.catch(() => {});
  }

  return {
    relabel,

    // Sink into the liquid and tumble to a random orientation.
    sink() {
      root.classList.remove("settled");
      return Promise.all([
        animateDepth(SUNK, { duration: 700, easing: "ease-in" }),
        spinTo(randomOrientation(), { duration: 1100, easing: "cubic-bezier(.3, .1, .3, 1)" }),
      ]);
    },

    // Rise until face `index` is flat against the window, text upright
    // (with a slight random tilt, like a real die pressed against glass).
    async rise(index) {
      const tilt = (Math.random() * 2 - 1) * MAX_TILT_DEG;
      const target = new DOMMatrix()
        .rotateSelf(0, 0, tilt)
        .multiplySelf(frames[index].matrix.inverse());
      if (reducedMotion()) {
        root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      }
      await Promise.all([
        animateDepth(RISEN, { duration: 1400, easing: "cubic-bezier(.2, .8, .2, 1)" }),
        spinTo(target, { duration: 1800, easing: "cubic-bezier(.16, .8, .24, 1)" }),
      ]);
      root.classList.add("settled");
    },
  };
}

// For each of the 20 faces, a rotation mapping the face element's own axes
// onto the die: x along the triangle's base, y from the apex toward the base,
// z straight out of the face. Face i points at the viewer when the die's
// transform is that rotation's inverse.
function icosahedronFaceFrames() {
  // The 12 vertices of an icosahedron with edge length 2.
  const vertices = [];
  for (const a of [-1, 1]) {
    for (const b of [-PHI, PHI]) {
      vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }

  const isEdge = (p, q) => Math.abs(Math.hypot(...sub(p, q)) - 2) < 1e-9;
  const frames = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      for (let k = j + 1; k < vertices.length; k++) {
        const [a, b, c] = [vertices[i], vertices[j], vertices[k]];
        if (!isEdge(a, b) || !isEdge(b, c) || !isEdge(a, c)) continue;

        const centroid = scale(add(add(a, b), c), 1 / 3);
        const normal = normalize(centroid);
        const down = normalize(sub(centroid, a)); // apex `a` sits at the top
        let across = normalize(sub(c, b));
        // across × down must equal the outward normal, or the face would be
        // mirrored (and hidden by backface-visibility).
        if (dot(cross(across, down), normal) < 0) {
          across = scale(across, -1);
        }
        frames.push({
          normal,
          matrix: new DOMMatrix([...across, 0, ...down, 0, ...normal, 0, 0, 0, 0, 1]),
        });
      }
    }
  }
  return frames;
}

function fitText(face, lineCount) {
  let size = FONT_BY_LINES[Math.min(lineCount, FONT_BY_LINES.length) - 1];
  for (;;) {
    face.style.fontSize = `calc(var(--edge) * ${size.toFixed(4)})`;
    if (size <= MIN_FONT || textFits(face)) return;
    size = Math.max(MIN_FONT, size * 0.92);
  }
}

// Layout sizes ignore transforms, so this works on the flat, untransformed
// triangle: its width grows linearly from 0 at the apex to the edge at the base.
function textFits(face) {
  const edge = face.offsetWidth;
  const height = face.offsetHeight;
  const text = face.firstElementChild;
  const top = text.offsetTop - text.offsetHeight / 2; // .face-text is shifted up by half its height
  if (top + text.offsetHeight > height - BASE_CLEARANCE * edge) return false;
  return [...text.children].every((line) => {
    const widthAtLine = (edge * (top + line.offsetTop)) / height;
    return line.offsetWidth <= widthAtLine - 2 * SIDE_CLEARANCE * edge;
  });
}

function randomOrientation() {
  return new DOMMatrix().rotateAxisAngleSelf(...randomAxis(), Math.random() * 360);
}

// Uniformly distributed unit vector.
function randomAxis() {
  const z = Math.random() * 2 - 1;
  const theta = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(a) {
  return scale(a, 1 / Math.hypot(...a));
}
