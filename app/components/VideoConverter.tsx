'use client';

import { useState, useRef, useEffect } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js',
});

let ffmpegLoaded = false;

export default function VideoConverter() {
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [outputFormat, setOutputFormat] = useState<string>('');
    const [isConverting, setIsConverting] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [outputUrl, setOutputUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    const [includeAudio, setIncludeAudio] = useState<boolean>(true);
    const [optimizationOption, setOptimizationOption] = useState<string>('none');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth <= 480);
        };
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError('File size exceeds 10MB limit');
            return;
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase();
        let newOutputFormat = '';

        if (fileExt === 'mp4') newOutputFormat = 'webm';
        else if (fileExt === 'webm') newOutputFormat = 'mp4';
        else {
            setError('Only MP4 and WebM files are supported');
            return;
        }

        setInputFile(file);
        setOutputFormat(newOutputFormat);
        setError('');
        setOutputUrl('');
    };

    const convertVideo = async () => {
        if (!inputFile || !outputFormat) return;

        try {
            setIsConverting(true);
            setProgress(0);
            setError('');

            if (!ffmpegLoaded) {
                setIsLoading(true);
                await ffmpeg.load();
                ffmpegLoaded = true;
                setIsLoading(false);
            }

            const fileExt = inputFile.name.split('.').pop()?.toLowerCase();
            const fileName = inputFile.name.replace(`.${fileExt}`, '');

            const inputFileName = `input.${fileExt}`;
            const outputFileName = `${fileName}.${outputFormat}`;

            ffmpeg.FS('writeFile', inputFileName, await fetchFile(inputFile));

            let args: string[];

            if (outputFormat === 'webm') {
                args = ['-i', inputFileName, '-c:v', 'vp8'];
                if (includeAudio) args.push('-c:a', 'libvorbis');
                else args.push('-an');

                switch (optimizationOption) {
                    case 'fps':
                        args.push('-r', '15', '-crf', '30', '-b:v', '0');
                        break;
                    case 'length':
                        args.push('-t', '30', '-crf', '30', '-b:v', '0');
                        break;
                    case 'quality':
                        args.push('-crf', '40', '-b:v', '0');
                        break;
                    case 'size':
                        args.push('-crf', '40', '-b:v', '0', '-r', '15');
                        if (includeAudio) args.push('-b:a', '64k');
                        break;
                    default:
                        args.push('-crf', '30', '-b:v', '0');
                }
            } else {
                args = ['-i', inputFileName, '-c:v', 'h264'];
                if (includeAudio) args.push('-c:a', 'aac');
                else args.push('-an');

                switch (optimizationOption) {
                    case 'fps':
                        args.push('-r', '15', '-crf', '23', '-preset', 'fast');
                        break;
                    case 'length':
                        args.push('-t', '30', '-crf', '23', '-preset', 'fast');
                        break;
                    case 'quality':
                        args.push('-crf', '35', '-preset', 'fast');
                        break;
                    case 'size':
                        args.push('-crf', '35', '-preset', 'fast', '-r', '15');
                        if (includeAudio) args.push('-b:a', '64k');
                        break;
                    default:
                        args.push('-crf', '23', '-preset', 'fast');
                }
            }

            args.push(outputFileName);

            ffmpeg.setProgress(({ ratio }) => {
                setProgress(Math.round(ratio * 100));
            });

            await ffmpeg.run(...args);

            const data = ffmpeg.FS('readFile', outputFileName);
            const buffer = data.buffer instanceof ArrayBuffer ? data.buffer : new ArrayBuffer(data.buffer.byteLength);
            const blob = new Blob([buffer], { type: `video/${outputFormat}` });
            const url = URL.createObjectURL(blob);

            setOutputUrl(url);
            setProgress(100);
        } catch (err) {
            console.error('Conversion error:', err);
            setError('An error occurred during conversion. Please try again.');
        } finally {
            setIsConverting(false);
        }
    };

    const resetForm = () => {
        setInputFile(null);
        setOutputFormat('');
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (outputUrl) {
            URL.revokeObjectURL(outputUrl);
            setOutputUrl('');
        }
    };

    useEffect(() => {
        return () => {
            if (outputUrl) URL.revokeObjectURL(outputUrl);
        };
    }, [outputUrl]);

    return (
        <div
            className={`post reply ${isMobile ? 'mobile-style' : 'desktop-style'}`}
            style={{
                marginTop: '10px',
                maxWidth: '600px',
                marginLeft: 'auto',
                marginRight: 'auto',
            }}
        >
            <div className="postInfo" />
            <blockquote className="postMessage">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <label htmlFor="videoFile" style={{ marginBottom: '5px', fontWeight: 'bold' }}>
                        Choose File <span className="fileText">(Max 10MB, .mp4 or .webm)</span>
                    </label>
                    <input
                        type="file"
                        id="videoFile"
                        ref={fileInputRef}
                        accept=".mp4,.webm"
                        onChange={handleFileChange}
                        className="post"
                        style={{ marginBottom: '10px' }}
                    />
                </div>
            </blockquote>

            {inputFile && (
                <>
                    <blockquote className="postMessage">
                        <div><b>Selected file:</b> <span className="fileText">{inputFile.name}</span></div>
                        <div><b>Will convert to:</b> <span className="fileText">{outputFormat.toUpperCase()}</span></div>

                        <div style={{ marginTop: '10px' }}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={includeAudio}
                                    onChange={() => setIncludeAudio(!includeAudio)}
                                />
                                &nbsp;Include audio in output
                            </label>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <b>Optimization options:</b><br />
                            {['none', 'fps', 'length', 'quality', 'size'].map((opt) => (
                                <div key={opt}>
                                    <label>
                                        <input
                                            type="radio"
                                            name="optimization"
                                            value={opt}
                                            checked={optimizationOption === opt}
                                            onChange={() => setOptimizationOption(opt)}
                                        />
                                        &nbsp;{opt === 'none' ? 'Do not alter output' :
                                            opt === 'fps' ? 'Limit FPS (15)' :
                                                opt === 'length' ? 'Limit to 30 seconds' :
                                                    opt === 'quality' ? 'Lower quality (CRF)' :
                                                        opt === 'size' ? 'Fit under 4MB' : opt}
                                    </label>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={convertVideo}
                            disabled={isConverting || isLoading}
                            className="button"
                            style={{ marginTop: '10px' }}
                        >
                            {isLoading ? 'Loading FFmpeg...' : isConverting ? 'Converting...' : 'Convert'}
                        </button>
                    </blockquote>
                </>
            )}

            {(isConverting || isLoading) && (
                <blockquote className="postMessage">
                    <div style={{ background: '#ccc', height: '10px', width: '100%' }}>
                        <div
                            style={{
                                height: '100%',
                                width: `${isLoading ? 50 : progress}%`,
                                backgroundColor: '#800000',
                            }}
                        />
                    </div>
                    <div style={{ marginTop: '5px' }}>
                        {isLoading ? 'Loading library...' : `${progress}% Complete`}
                    </div>
                </blockquote>
            )}

            {error && (
                <blockquote className="postMessage">
                    <span className="redtxt">{error}</span>
                </blockquote>
            )}

            {outputUrl && (
                <blockquote className="postMessage">
                    <video src={outputUrl} controls style={{ width: '100%', marginBottom: '10px' }} />
                    <div>
                        <a href={outputUrl} download={`converted.${outputFormat}`} className="button">Download</a>
                        &nbsp;
                        <button onClick={resetForm} className="button redButton">Convert Another</button>
                    </div>
                </blockquote>
            )}

            {/* Style definitions inline (or move to a CSS file/module) */}
            <style jsx>{`
                .desktop-style {
                padding: 10px;
                font-size: 10pt;
                }

                .mobile-style {
                padding: 20px;
                font-size: 11pt;
                }

                .desktop-style, .mobile-style {
                transition: padding 0.3s ease, font-size 0.3s ease;
                }
            `}</style>
        </div>
    );
}
