import ytdl from '@distube/ytdl-core'

/**
 * Прямое получение аудио через YouTube (работает с Vercel, без Piped/Invidious).
 */
export async function extractViaYtdl(videoId, watchUrl) {
  const url = watchUrl || `https://www.youtube.com/watch?v=${videoId}`

  const info = await ytdl.getInfo(url, {
    requestOptions: {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    },
  })

  const format = ytdl.chooseFormat(info.formats, {
    quality: 'highestaudio',
    filter: (f) => f.hasAudio && !f.hasVideo && f.url,
  })

  if (!format?.url) {
    const fallback = ytdl.chooseFormat(info.formats, {
      quality: 'lowestaudio',
      filter: 'audioonly',
    })
    if (!fallback?.url) throw new Error('ytdl: нет аудио-потока')
    return buildResult(info, fallback)
  }

  return buildResult(info, format)
}

function buildResult(info, format) {
  const vd = info.videoDetails
  return {
    title: vd?.title || 'Подкаст с YouTube',
    description: (vd?.description || '').slice(0, 500),
    audioUrl: format.url,
    duration: parseInt(vd?.lengthSeconds || '0', 10) || 0,
    authorName: vd?.author?.name || vd?.ownerChannelName || '',
    coverUrl: vd?.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '',
  }
}
