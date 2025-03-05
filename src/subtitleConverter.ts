import * as fs from 'fs';

interface SubtitleEntry {
    startTime: number;  // saniye cinsinden
    endTime: number;    // saniye cinsinden
    text: string;
}

export class SubtitleConverter {
    private static supportedFormats = ['srt', 'vtt', 'ass', 'ssa', 'sub'];

    // Zaman formatını parse eden genel metodlar
    private static parseTime(timeStr: string, format: string): number {
        switch (format) {
            case 'srt':
                return this.parseSrtTime(timeStr);
            case 'vtt':
                return this.parseVttTime(timeStr);
            case 'ass':
            case 'ssa':
                return this.parseAssTime(timeStr);
            case 'sub':
                return this.parseSubTime(timeStr);
            default:
                throw new Error(`Desteklenmeyen format: ${format}`);
        }
    }

    // SRT zaman formatı (00:00:00,000)
    private static parseSrtTime(timeStr: string): number {
        const [hours, minutes, secondsMs] = timeStr.split(':');
        const [seconds, milliseconds] = secondsMs.split(',');
        return parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds) +
            parseFloat(milliseconds) / 1000;
    }

    // VTT zaman formatı (00:00:00.000)
    private static parseVttTime(timeStr: string): number {
        const [hours, minutes, secondsMs] = timeStr.split(':');
        const [seconds, milliseconds] = secondsMs.split('.');
        return parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds) +
            parseFloat(milliseconds) / 1000;
    }

    // ASS/SSA zaman formatı (0:00:00.00)
    private static parseAssTime(timeStr: string): number {
        const [hours, minutes, secondsMs] = timeStr.split(':');
        const [seconds, milliseconds] = secondsMs.split('.');
        return parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds) +
            parseFloat(milliseconds) / 100;
    }

    // SUB zaman formatı
    private static parseSubTime(timeStr: string): number {
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 3600 +
            parseInt(parts[1]) * 60 +
            parseFloat(parts[2]);
    }

    // Format'a göre subtitle parse eden metodlar
    private static parseSubtitles(content: string, format: string): SubtitleEntry[] {
        switch (format) {
            case 'srt':
                return this.parseSrt(content);
            case 'vtt':
                return this.parseVtt(content);
            case 'ass':
            case 'ssa':
                return this.parseAss(content);
            case 'sub':
                return this.parseSub(content);
            default:
                throw new Error(`Desteklenmeyen format: ${format}`);
        }
    }

    // SRT parse
    private static parseSrt(content: string): SubtitleEntry[] {
        const entries: SubtitleEntry[] = [];
        const blocks = content.split('\n\n');

        blocks.forEach(block => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
                if (timeMatch) {
                    entries.push({
                        startTime: this.parseSrtTime(timeMatch[1]),
                        endTime: this.parseSrtTime(timeMatch[2]),
                        text: lines.slice(2).join('\n').trim()
                    });
                }
            }
        });

        return entries;
    }

    // VTT parse
    private static parseVtt(content: string): SubtitleEntry[] {
        const entries: SubtitleEntry[] = [];
        const lines = content.split('\n');
        let currentEntry: Partial<SubtitleEntry> = {};

        lines.forEach(line => {
            const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
            if (timeMatch) {
                currentEntry = {
                    startTime: this.parseVttTime(timeMatch[1]),
                    endTime: this.parseVttTime(timeMatch[2])
                };
            } else if (line.trim() && !line.startsWith('WEBVTT') && currentEntry.startTime) {
                currentEntry.text = (currentEntry.text || '') + line.trim() + '\n';
            }

            if (currentEntry.startTime && currentEntry.text) {
                entries.push(currentEntry as SubtitleEntry);
                currentEntry = {};
            }
        });

        return entries;
    }

    // ASS/SSA parse
    private static parseAss(content: string): SubtitleEntry[] {
        const entries: SubtitleEntry[] = [];
        const lines = content.split('\n');

        lines.forEach(line => {
            if (line.startsWith('Dialogue:')) {
                const parts = line.split(',');
                if (parts.length >= 10) {
                    const startTime = this.parseAssTime(parts[1]);
                    const endTime = this.parseAssTime(parts[2]);
                    const text = parts.slice(9).join(',')
                        .replace(/\{[^}]*}/g, '') // stil etiketlerini temizler
                        .trim();
                    entries.push({ startTime, endTime, text });
                }
            }
        });

        return entries;
    }

    // SUB parse
    private static parseSub(content: string): SubtitleEntry[] {
        const entries: SubtitleEntry[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 < lines.length) {
                const timeCodes = lines[i].split(',');
                const text = lines[i + 1];

                if (timeCodes.length === 2) {
                    entries.push({
                        startTime: this.parseSubTime(timeCodes[0]),
                        endTime: this.parseSubTime(timeCodes[1]),
                        text: text.trim()
                    });
                }
            }
        }

        return entries;
    }

    // SRT formatına dönüştürme
    private static convertToSrt(entries: SubtitleEntry[]): string {
        return entries.map((entry, index) => {
            const startTime = this.secondsToSrtTime(entry.startTime);
            const endTime = this.secondsToSrtTime(entry.endTime);

            return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text.trim()}\n`;
        }).join('\n');
    }

    // Saniyeyi SRT zaman formatına çevirme
    private static secondsToSrtTime(seconds: number): string {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    // Ana dönüşüm metodu
    static convert(format: string,data:string, outputPath?: string): string {

        // Desteklenen format mı kontrol et
        if (!this.supportedFormats.includes(format)) {
            throw new Error(`Desteklenmeyen subtitle formatı: ${format}`);
        }


        // Subtitle'ları parse et
        const entries = this.parseSubtitles(data, format);

        // SRT'ye dönüştür
        const srtContent = this.convertToSrt(entries);

        // Çıktı dosyası belirtilmişse kaydet
        if (outputPath) {
            fs.writeFileSync(outputPath, srtContent, 'utf-8');
        }

        return srtContent;
    }
}