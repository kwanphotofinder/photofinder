import { getSystemSecret } from "@/lib/system-settings";

const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message/push";

export async function pushPhotoMatchNotification(
  lineUserId: string,
  eventName: string,
  confidence: number,
  photoUrl: string,
  actionUrl: string,
) {
  const token = (await getSystemSecret("LINE_CHANNEL_ACCESS_TOKEN")) || process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    console.warn(
      "LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping LINE notification.",
    );
    return;
  }

  const flexMessage = {
    type: "flex",
    altText: `New photo found at ${eventName}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: photoUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
        action: {
          type: "uri",
          uri: actionUrl,
        },
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "New Photo Found!",
            weight: "bold",
            size: "xl",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Event",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2,
                  },
                  {
                    type: "text",
                    text: eventName,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "AI Match",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2,
                  },
                  {
                    type: "text",
                    text: `${(confidence * 100).toFixed(1)}%`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };

  try {
    const response = await fetch(LINE_MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [flexMessage],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to send LINE notification:", errorData);
    }
  } catch (error) {
    console.error("Error sending LINE notification:", error);
  }
}

export async function pushBatchPhotoMatchNotification(
  lineUserId: string,
  eventName: string,
  matchCount: number,
  actionUrl: string,
) {
  const token = (await getSystemSecret("LINE_CHANNEL_ACCESS_TOKEN")) || process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    console.warn(
      "LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping LINE notification.",
    );
    return;
  }

  const flexMessage = {
    type: "flex",
    altText: `${matchCount} photos found at ${eventName}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "Photos Found!",
            weight: "bold",
            size: "xl",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Event",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2,
                  },
                  {
                    type: "text",
                    text: eventName,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Matches",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2,
                  },
                  {
                    type: "text",
                    text: `${matchCount} photos`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "View Photos",
              uri: actionUrl,
            },
          },
        ],
        flex: 0,
      },
    },
  };

  try {
    const response = await fetch(LINE_MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [flexMessage],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to send LINE notification:", errorData);
    }
  } catch (error) {
    console.error("Error sending LINE notification:", error);
  }
}


export async function pushImportCompletionNotification(
  lineUserId: string,
  eventName: string,
  importedCount: number,
  skippedCount: number,
  actionUrl: string,
) {
  const token = (await getSystemSecret("LINE_CHANNEL_ACCESS_TOKEN")) || process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) return;

  const flexMessage = {
    type: "flex",
    altText: `นำเข้าภาพ ${importedCount} รูปเสร็จสมบูรณ์ - ${eventName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#059669",
        paddingAll: "lg",
        contents: [
          {
            type: "text",
            text: "✅ นำเข้าภาพเสร็จสมบูรณ์",
            color: "#ffffff",
            weight: "bold",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: eventName,
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "separator",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "นำเข้าสำเร็จ:",
                color: "#6b7280",
                size: "sm",
              },
              {
                type: "text",
                text: `${importedCount} ภาพ`,
                weight: "bold",
                color: "#059669",
                size: "sm",
                align: "end",
              },
            ],
          },
          ...(skippedCount > 0
            ? [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    {
                      type: "text",
                      text: "รูปซ้ำ (ข้าม):",
                      color: "#6b7280",
                      size: "sm",
                    },
                    {
                      type: "text",
                      text: `${skippedCount} ภาพ`,
                      color: "#9ca3af",
                      size: "sm",
                      align: "end",
                    },
                  ],
                },
              ]
            : []),
          {
            type: "text",
            text: "🤖 AI กำลังสแกนตรวจจับใบหน้าในเบื้องหลัง",
            color: "#6b7280",
            size: "xs",
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#82181a",
            height: "sm",
            action: {
              type: "uri",
              label: "เปิดดูอัลบั้ม",
              uri: actionUrl,
            },
          },
        ],
      },
    },
  };

  try {
    await fetch(LINE_MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [flexMessage],
      }),
    });
  } catch (err) {
    console.error("Failed to send LINE import completion notification:", err);
  }
}
