// App.js
import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KImage, Text, Transformer } from "react-konva";

/* ===================== IMAGE COMPONENT ===================== */
function URLImage({ layer, canvasSize, isSelected, onSelect, onChange }) {
  const [image, setImage] = useState(null);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (!layer?.data?.src) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = layer.data.src;
    img.onload = () => setImage(img);
  }, [layer?.data?.src]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!image) return null;

  return (
    <>
      <KImage
        ref={shapeRef}
        image={image}
        x={layer.data.x ?? canvasSize.width / 2}
        y={layer.data.y ?? canvasSize.height / 2}
        offsetX={image.width / 2}
        offsetY={image.height / 2}
        scaleX={layer.data.scale ?? 1}
        scaleY={layer.data.scale ?? 1}
        rotation={layer.data.rotation ?? 0}
        draggable
        onClick={(e) => {
          onSelect(layer.id);
          e.cancelBubble = true;
        }}
        onTap={() => onSelect(layer.id)}
        onDragEnd={(e) =>
          onChange(layer.id, {
            ...layer.data,
            x: e.target.x(),
            y: e.target.y(),
          })
        }
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange(layer.id, {
            ...layer.data,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scale: node.scaleX(),
          });
        }}
        // nice soft shadow
        shadowBlur={6}
      />
      {isSelected && <Transformer ref={trRef} rotateEnabled={true} />}
    </>
  );
}

/* ===================== EDITABLE TEXT COMPONENT ===================== */
function EditableText({ layer, isSelected, onSelect, onChange }) {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        {...layer.data}
        ref={shapeRef}
        draggable
        onClick={(e) => {
          onSelect(layer.id);
          e.cancelBubble = true;
        }}
        onTap={() => onSelect(layer.id)}
        onDragEnd={(e) =>
          onChange(layer.id, { ...layer.data, x: e.target.x(), y: e.target.y() })
        }
        onTransformEnd={() => {
          const node = shapeRef.current;
          // Use scaleX to adjust fontSize and then reset scale to 1 so shapeProps stays consistent
          const scaleX = node.scaleX();
          const newFontSize = (layer.data.fontSize || 20) * scaleX;
          onChange(layer.id, {
            ...layer.data,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            fontSize: newFontSize,
          });
        }}
      />
      {isSelected && <Transformer ref={trRef} rotateEnabled={true} />}
    </>
  );
}

/* ===================== MAIN APP ===================== */
export default function App() {
  // single layers array: topmost is last in array (rendered in order)
  const [layers, setLayers] = useState([
    // example starter text layers (you can remove)
    {
      id: "text-headline",
      type: "text",
      data: {
        text: "Summer Sale Up to 50% Off",
        x: 40,
        y: 40,
        fontSize: 64,
        fill: "#ffffff",
        fontStyle: "bold",
        draggable: true,
      },
    },
    {
      id: "text-cta",
      type: "text",
      data: {
        text: "Shop Now",
        x: 40,
        y: 140,
        fontSize: 40,
        fill: "#ffcc00",
        fontStyle: "600",
        draggable: true,
      },
    },
  ]);

  /* BACKGROUND */
  const [bgColor, setBgColor] = useState("#111");
  const [bgImage, setBgImage] = useState(null);

  const [canvasSize, setCanvasSize] = useState({ width: 1080, height: 1080 });

  const stageRef = useRef();
  const [selectedId, setSelectedId] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // action to apply when user chooses layer

  /* Helpers */
  const findLayerIndex = (id) => layers.findIndex((l) => l.id === id);

  /* FILE UPLOAD: add image layer on top */
  const handleFile = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  const newLayer = {
    id: `image-${Date.now()}`,
    type: "image",
    data: {
      src: url,
      blob: file,  // <-- store original file here
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      scale: 1,
      rotation: 0,
    },
  };

  setLayers((prev) => [...prev, newLayer]);
};


  /* ADD TEXT LAYER helper (keeps existing text controls consistent) */
  const addTextLayer = (opts = {}) => {
    const id = `text-${Date.now()}`;
    const textLayer = {
      id,
      type: "text",
      data: {
        text: opts.text || "New Text",
        x: opts.x ?? 60,
        y: opts.y ?? 60,
        fontSize: opts.fontSize || 36,
        fill: opts.fill || "#ffffff",
        fontStyle: opts.fontStyle || "normal",
      },
    };
    setLayers((prev) => [...prev, textLayer]);
    setTimeout(() => setSelectedId(id), 50);
  };

  /* APPLY ACTION: zoom/rotate/removeBG */
  const handleAction = (action) => {
    setPendingAction(action);
    const imageCount = layers.filter((l) => l.type === "image").length;
    if (imageCount === 0) return; // nothing
    if (imageCount === 1) {
      // auto apply to only image layer
      const singleImg = layers.find((l) => l.type === "image");
      applyAction(action, singleImg.id);
      return;
    }
    // else show popup for which image to apply
    setShowPopup(true);
  };

  const applyAction = async (action, id) => {
    setShowPopup(false);
    setPendingAction(null);
    if (!id) return;
    if (action === "zoom+") return transformLayerScale(id, +0.1);
    if (action === "zoom-") return transformLayerScale(id, -0.1);
    if (action === "rotateL") return transformLayerRotate(id, -15);
    if (action === "rotateR") return transformLayerRotate(id, +15);
    if (action === "removeBG") return removeBG(id);
  };

  const transformLayerScale = (id, delta) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === id && l.type === "image"
          ? { ...l, data: { ...l.data, scale: Math.max(0.2, (l.data.scale || 1) + delta) } }
          : l
      )
    );
  };

  const transformLayerRotate = (id, delta) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === id && l.type === "image"
          ? { ...l, data: { ...l.data, rotation: (l.data.rotation || 0) + delta } }
          : l
      )
    );
  };

  /* Remove background: keeps your API call as before */
  const removeBG = async (id) => {
  const layer = layers.find((l) => l.id === id);
  if (!layer || layer.type !== "image") return;

  try {
    const formData = new FormData();

    // use the stored blob instead of fetching blob URL
    formData.append("image", layer.data.blob, "image.png");

    const res = await fetch("https://backend-creative-pilot.onrender.com/remove-bg", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Remove BG failed!");

    const newBlob = await res.blob();
    const newUrl = URL.createObjectURL(newBlob);

    setLayers((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, data: { ...l.data, src: newUrl, blob: new File([newBlob], "removed.png", { type: "image/png" })
 } }
          : l
      )
    );
  } catch (err) {
    console.error(err);
    alert("Remove BG failed!");
  }
};


  /* DOWNLOAD canvas */
  const downloadImage = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    const link = document.createElement("a");
    link.download = "creative.png";
    link.href = uri;
    link.click();
  };

  /* LAYERS PANEL: move up/down/delete */
  const moveLayer = (id, direction) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      if (direction === "up" && idx < newArr.length - 1) {
        [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
        return newArr;
      }
      if (direction === "down" && idx > 0) {
        [newArr[idx], newArr[idx - 1]] = [newArr[idx - 1], newArr[idx]];
        return newArr;
      }
      return prev;
    });
  };

  const deleteLayer = (id) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  /* Layer data update from child components */
  const updateLayerData = (id, newData) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, data: newData } : l)));
  };

  /* UI helpers - color controls update text layers that match headline/cta ids */
  const setHeadlineText = (txt) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.type === "text" && l.id === "text-headline" ? { ...l, data: { ...l.data, text: txt } } : l
      )
    );
  };
  const setCtaText = (txt) => {
    setLayers((prev) =>
      prev.map((l) => (l.type === "text" && l.id === "text-cta" ? { ...l, data: { ...l.data, text: txt } } : l))
    );
  };
  const setHeadlineColor = (color) => {
    setLayers((prev) =>
      prev.map((l) => (l.type === "text" && l.id === "text-headline" ? { ...l, data: { ...l.data, fill: color } } : l))
    );
  };
  const setCtaColor = (color) => {
    setLayers((prev) =>
      prev.map((l) => (l.type === "text" && l.id === "text-cta" ? { ...l, data: { ...l.data, fill: color } } : l))
    );
  };

  /* when clicking canvas blank area, deselect */
  const handleStageMouseDown = (e) => {
    // clicked on stage background
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      return;
    }
    // otherwise let individual shapes handle selection
  };

  /* return current image layers for popup selection */
  const imageLayers = layers.filter((l) => l.type === "image");

  /* RENDER */
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 20, display: "flex", alignItems: "flex-start" }}>
      {/* LEFT: Layers Panel */}
      <div style={{
        width: 260,
        background: "#161616",
        color: "white",
        padding: 15,
        borderRadius: 10,
        marginRight: 16,
        height: "calc(100vh - 40px)",
        overflow: "auto",
        position: "sticky",
        top: 20
      }}>
        <h3 style={{
          marginBottom: "14px",
          fontSize: "24px",
          fontWeight: "700",
          textAlign: "center",
          letterSpacing: "0.5px"
        }}>
        Layers
      </h3>

        {/* add quick layer buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={miniActionBtn} onClick={() => addTextLayer({ text: "New Heading", fontSize: 40 })}>+ Text</button>
          <label style={miniActionBtnLabel}>
            + Image
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
        </div>

        {layers.length === 0 && <div style={{ color: "#aaa" }}>No layers yet — add image or text.</div>}

        {layers.map((l, idx) => (
          <div key={l.id} style={{
            padding: 8,
            marginBottom: 8,
            background: selectedId === l.id ? "#2b2b2b" : "#222",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer"
          }} onClick={() => setSelectedId(l.id)}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 13 }}>
                {l.type === "image" ? `🖼 Image ${idx + 1}` : `🔤 ${l.data.text?.slice(0, 20) || l.id}`}
              </div>
              <div style={{ fontSize: 11, color: "#999" }}>{l.id}</div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button style={miniBtn} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "up"); }}>⬆</button>
              <button style={miniBtn} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "down"); }}>⬇</button>
              <button style={miniBtnDanger} onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}>✖</button>
            </div>
          </div>
        ))}

        <hr style={{ border: "none", height: 1, background: "#2a2a2a", margin: "12px 0" }} />

        {/* quick color + sample controls for headline/cta */}
        <div style={{ marginTop: 6 }}>
          <div style={{ marginBottom: 6, color: "#bbb" }}>Headline</div>
          <input
            type="text"
            placeholder="Headline text"
            value={layers.find(l => l.id === "text-headline")?.data?.text || ""}
            onChange={(e) => setHeadlineText(e.target.value)}
            style={sidebarInput}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={layers.find(l => l.id === "text-headline")?.data?.fill || "#ffffff"} onChange={(e) => setHeadlineColor(e.target.value)} />
            <button style={miniActionBtn} onClick={() => setLayers(prev => prev.map(l => l.id === "text-headline" ? { ...l, data: { ...l.data, fontSize: (l.data.fontSize || 36) + 4 } } : l))}>A+</button>
            <button style={miniActionBtn} onClick={() => setLayers(prev => prev.map(l => l.id === "text-headline" ? { ...l, data: { ...l.data, fontSize: Math.max(8, (l.data.fontSize || 36) - 4) } } : l))}>A-</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#bbb" }}>CTA</div>
          <input
            type="text"
            placeholder="CTA text"
            value={layers.find(l => l.id === "text-cta")?.data?.text || ""}
            onChange={(e) => setCtaText(e.target.value)}
            style={sidebarInput}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={layers.find(l => l.id === "text-cta")?.data?.fill || "#ffcc00"} onChange={(e) => setCtaColor(e.target.value)} />
            <button style={miniActionBtn} onClick={() => setLayers(prev => prev.map(l => l.id === "text-cta" ? { ...l, data: { ...l.data, fontSize: (l.data.fontSize || 24) + 2 } } : l))}>A+</button>
            <button style={miniActionBtn} onClick={() => setLayers(prev => prev.map(l => l.id === "text-cta" ? { ...l, data: { ...l.data, fontSize: Math.max(8, (l.data.fontSize || 24) - 2) } } : l))}>A-</button>
          </div>
        </div>

      </div>

      {/* MAIN: Canvas and controls */}
      <div style={{ flex: 1 }}>
        <h2 style={{ color: "#fff",fontSize: "40px",fontWeight: "800",marginBottom: "25px",textAlign: "center",letterSpacing: "1px" }}>CreativePilot — Ad Creative Builder</h2>

        {/* canvas size buttons */}
        <div style={{  marginBottom: 20,width: "100%",display: "flex",justifyContent: "center",gap: "10px",flexWrap: "wrap"}}>
          <button style={btn} onClick={() => setCanvasSize({ width: 1080, height: 1080 })}>IG Post 1080×1080</button>
          <button style={btn} onClick={() => setCanvasSize({ width: 1200, height: 628 })}>FB Feed 1200×628</button>
          <button style={btn} onClick={() => setCanvasSize({ width: 1080, height: 1920 })}>IG Story 1080×1920</button>
        </div>

        {/* background controls */}
        <div style={{ marginBottom: 15,width: "100%",display: "flex",justifyContent: "center",alignItems: "center",gap: "10px",flexWrap: "wrap" }}>
          <span style={{ color: "#ddd" }}>Background:</span>
          <button style={btn} onClick={() => { setBgImage(null); setBgColor("#ffffff"); }}>White</button>
          <button style={btn} onClick={() => { setBgImage(null); setBgColor("#000000"); }}>Black</button>
          <button style={btn} onClick={() => { setBgImage(null); setBgColor("linear-gradient(45deg,#ff9a00,#ff0055)"); }}>Gradient</button>
          <button style={btn} onClick={() => document.getElementById("bgPicker")?.click()}>Choose Background</button>
          <input id="bgPicker" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBgImage(URL.createObjectURL(f));
          }} />
        </div>

        {/* action buttons */}
        <div style={{ marginBottom: 15,width: "100%",display: "flex",justifyContent: "center",gap: "10px",flexWrap: "wrap" }}>
          <label style={btnFile}>
            Upload Image
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>

          <button style={btn} onClick={() => handleAction("zoom+")}>Zoom +</button>
          <button style={btn} onClick={() => handleAction("zoom-")}>Zoom -</button>
          <button style={btn} onClick={() => handleAction("rotateL")}>Rotate ⟲</button>
          <button style={btn} onClick={() => handleAction("rotateR")}>Rotate ⟳</button>
          <button style={btn} onClick={() => { setPendingAction("removeBG"); const imageCount = imageLayers.length; if (imageCount === 1) applyAction("removeBG", imageLayers[0].id); else setShowPopup(true); }}>Remove BG</button>
          <button style={btnDanger} onClick={() => { if (confirm("Clear all layers?")) { setLayers([]); setSelectedId(null); } }}>Clear All</button>
          <button style={btnAccent} onClick={downloadImage}>Download PNG</button>
        </div>

        {/* STAGE */}
        <div style={{
  background: "#111",
  padding: 12,
  borderRadius: 12,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
}}>
          <Stage
            ref={stageRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
            style={{ border: "2px solid #333", borderRadius: 8 }}
          >
            {/* background layer (static) */}
            <Layer>
              {!bgImage && (
                // when bgColor is gradient string, Konva rect won't accept CSS gradient — so handle simple colors
                <KImage
                  image={(function () {
                    const c = document.createElement("canvas");
                    c.width = canvasSize.width;
                    c.height = canvasSize.height;
                    const ctx = c.getContext("2d");
                    if (typeof bgColor === "string" && bgColor.startsWith("linear-gradient")) {
                      // create a simple gradient fallback
                      const g = ctx.createLinearGradient(0, 0, canvasSize.width, canvasSize.height);
                      g.addColorStop(0, "#ff9a00");
                      g.addColorStop(1, "#ff0055");
                      ctx.fillStyle = g;
                      ctx.fillRect(0, 0, c.width, c.height);
                    } else {
                      ctx.fillStyle = bgColor || "#111";
                      ctx.fillRect(0, 0, c.width, c.height);
                    }
                    const img = new window.Image();
                    img.src = c.toDataURL();
                    return img;
                  })()}
                  x={0}
                  y={0}
                  width={canvasSize.width}
                  height={canvasSize.height}
                />
              )}
              {bgImage && (
                <KImage
                  image={(function () {
                    const img = new window.Image();
                    img.crossOrigin = "anonymous";
                    img.src = bgImage;
                    return img;
                  })()}
                  x={0}
                  y={0}
                  width={canvasSize.width}
                  height={canvasSize.height}
                />
              )}
            </Layer>

            {/* layers rendered in order */}
            <Layer>
              {layers.map((l) => {
                if (l.type === "image") {
                  return (
                    <URLImage
                      key={l.id}
                      layer={l}
                      canvasSize={canvasSize}
                      isSelected={selectedId === l.id}
                      onSelect={(id) => setSelectedId(id)}
                      onChange={(id, newData) => updateLayerData(id, newData)}
                    />
                  );
                }
                if (l.type === "text") {
                  return (
                    <EditableText
                      key={l.id}
                      layer={l}
                      isSelected={selectedId === l.id}
                      onSelect={(id) => setSelectedId(id)}
                      onChange={(id, newData) => updateLayerData(id, newData)}
                    />
                  );
                }
                return null;
              })}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* POPUP to choose which image (if multiple) for actions */}
      {showPopup && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)",
        }}>
          <div style={{ background: "#222", padding: 20, borderRadius: 8, width: 320 }}>
            <h3 style={{ color: "#fff", marginBottom: 10 }}>Select Image</h3>
            {imageLayers.map((img, idx) => (
              <div key={img.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ color: "#ddd" }}>Image {idx + 1}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={miniBtn} onClick={() => applyAction(pendingAction || "zoom+", img.id)}>{pendingAction === "zoom+" ? "Zoom+" : (pendingAction === "zoom-" ? "Zoom-" : "Apply")}</button>
                  <button style={miniBtnDanger} onClick={() => applyAction(pendingAction || "removeBG", img.id)}>Apply</button>
                </div>
              </div>
            ))}
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button style={btnClose} onClick={() => setShowPopup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== STYLES ===================== */
const btn = {
  padding: "8px 12px",
  marginRight: 8,
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: 6,
  cursor: "pointer",
};
const btnAccent = {
  padding: "8px 12px",
  background: "#0066ff",
  color: "#fff",
  border: "1px solid #0052cc",
  borderRadius: 6,
  cursor: "pointer",
};
const btnDanger = {
  padding: "8px 12px",
  background: "#b30000",
  color: "#fff",
  border: "1px solid #7f0000",
  borderRadius: 6,
  cursor: "pointer",
};

const input = {
  padding: 10,
  marginRight: 10,
  width: 260,
  borderRadius: 8,
};

const sidebarInput = {
  width: "100%",
  padding: 8,
  borderRadius: 6,
  marginBottom: 8,
  border: "1px solid #333",
  background: "#0f0f0f",
  color: "#fff"
};

const miniBtn = {
  marginLeft: 4,
  background: "#444",
  border: "none",
  padding: "4px 6px",
  color: "white",
  borderRadius: 4,
  cursor: "pointer",
};

const miniBtnDanger = {
  marginLeft: 4,
  background: "#b30000",
  border: "none",
  padding: "4px 6px",
  color: "white",
  borderRadius: 4,
  cursor: "pointer",
};

const miniActionBtn = {
  padding: "6px 8px",
  background: "#2b2b2b",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  cursor: "pointer",
};
const miniActionBtnLabel = {
  padding: "6px 8px",
  background: "#2b2b2b",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8
};

const btnFile = {
  padding: "8px 12px",
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
};

const btnClose = {
  padding: "8px 12px",
  background: "#444",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  cursor: "pointer",
};
