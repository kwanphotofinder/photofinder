const LINE_MESSAGING_API = 'https://api.line.me/v2/bot/message/push';

export async function pushPhotoMatchNotification(
  lineUserId: string,
  eventName: string,
  confidence: number,
  photoUrl: string,
  actionUrl: string
) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  if (!token) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN is missing. Skipping LINE notification.');
    return;
  }

  const flexMessage = {
    type: 'flex',
    altText: `New photo found at ${eventName}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: photoUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
        action: {
          type: 'uri',
          uri: actionUrl,
        },
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'New Photo Found!',
            weight: 'bold',
            size: 'xl',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: 'Event',
                    color: '#aaaaaa',
                    size: 'sm',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: eventName,
                    wrap: true,
                    color: '#666666',
                    size: 'sm',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: 'AI Match',
                    color: '#aaaaaa',
                    size: 'sm',
                    flex: 2,
                  },
                  {
                    type: 'text',
                    text: `${(confidence * 100).toFixed(1)}%`,
                    wrap: true,
                    color: '#666666',
                    size: 'sm',
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [flexMessage],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to send LINE notification:', errorData);
    }
  } catch (error) {
    console.error('Error sending LINE notification:', error);
  }
}
