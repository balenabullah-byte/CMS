import QRCode from 'qrcode'

export async function renderLabel(label) {
  const canvas = document.createElement('canvas')
  canvas.width = 760
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 32px sans-serif'
  const lines = ['']
  for (const char of label.resource.name) {
    if (ctx.measureText(lines.at(-1) + char).width > 690) lines.push('')
    lines[lines.length - 1] += char
  }
  canvas.height = 650 + lines.length * 40
  ctx.fillStyle = '#fff'
  ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.font = '24px sans-serif'
  ctx.fillText('Campus Resource Hub',380,42)
  ctx.font = 'bold 32px sans-serif'
  lines.forEach((line,i)=>ctx.fillText(line,380,95+i*40))
  const top = 100 + lines.length*40
  ctx.font = '24px sans-serif'
  ctx.fillText(label.resource.identifier,380,top,690)
  const qr = await QRCode.toCanvas(label.url,{width:440,margin:4,errorCorrectionLevel:'M'})
  ctx.drawImage(qr,160,top+8)
  ctx.fillText('Scan to report a maintenance problem.',380,top+476)
  if(label.development) ctx.fillText('Development label',380,top+518)
  return canvas.toDataURL('image/png')
}
