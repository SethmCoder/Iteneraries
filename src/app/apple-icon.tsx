import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1616C9",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 999,
            border: "10px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: "white",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
