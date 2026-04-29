#!/usr/bin/env swift
import AppKit
import CoreImage
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

func usage() -> Never {
    fail("""
    Usage:
      qr_tools.swift generate <url> <out.png> [size] [label]
      qr_tools.swift validate <image.png>
    """)
}

func pngData(from image: NSImage) -> Data? {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff) else {
        return nil
    }
    return rep.representation(using: .png, properties: [:])
}

func generateQR(url: String, outPath: String, size: Int, label: String?) {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
        fail("Could not create QR filter")
    }
    filter.setValue(Data(url.utf8), forKey: "inputMessage")
    filter.setValue("Q", forKey: "inputCorrectionLevel")
    guard let qr = filter.outputImage else {
        fail("Could not generate QR image")
    }

    let extent = qr.extent.integral
    let scale = CGFloat(size) / extent.width
    let scaled = qr.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let context = CIContext(options: nil)
    guard let cg = context.createCGImage(scaled, from: CGRect(x: 0, y: 0, width: CGFloat(size), height: CGFloat(size))) else {
        fail("Could not render QR image")
    }

    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
    NSGraphicsContext.current?.imageInterpolation = .none
    NSImage(cgImage: cg, size: NSSize(width: size, height: size)).draw(
        in: NSRect(x: 0, y: 0, width: size, height: size),
        from: .zero,
        operation: .sourceOver,
        fraction: 1.0
    )

    if let label = label, !label.isEmpty {
        let boxWidth = CGFloat(size) * 0.38
        let boxHeight = CGFloat(size) * 0.20
        let box = NSRect(
            x: (CGFloat(size) - boxWidth) / 2,
            y: (CGFloat(size) - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight
        )
        let path = NSBezierPath(roundedRect: box, xRadius: 7, yRadius: 7)
        NSColor.white.withAlphaComponent(0.94).setFill()
        path.fill()

        let fontSize = CGFloat(size) * 0.115
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: fontSize, weight: .semibold),
            .foregroundColor: NSColor(calibratedRed: 0.22, green: 0.12, blue: 0.06, alpha: 1.0),
            .paragraphStyle: paragraph,
        ]
        let textSize = label.size(withAttributes: attrs)
        let textRect = NSRect(
            x: box.minX,
            y: box.midY - textSize.height / 2 - 1,
            width: box.width,
            height: textSize.height + 2
        )
        label.draw(in: textRect, withAttributes: attrs)
    }
    image.unlockFocus()

    guard let data = pngData(from: image) else {
        fail("Could not encode PNG")
    }
    do {
        try data.write(to: URL(fileURLWithPath: outPath))
        print(outPath)
    } catch {
        fail("Could not write \(outPath): \(error)")
    }
}

func validateQR(path: String) {
    guard let image = CIImage(contentsOf: URL(fileURLWithPath: path)) else {
        fail("Could not open image: \(path)")
    }
    guard let detector = CIDetector(
        ofType: CIDetectorTypeQRCode,
        context: nil,
        options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]
    ) else {
        fail("Could not create QR detector")
    }
    let features = detector.features(in: image)
    print(features.count)
    for feature in features {
        if let qr = feature as? CIQRCodeFeature {
            print(qr.messageString ?? "nil")
        }
    }
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    usage()
}

switch args[1] {
case "generate":
    guard args.count >= 4 else { usage() }
    let size = args.count >= 5 ? (Int(args[4]) ?? 220) : 220
    let label = args.count >= 6 ? args[5] : nil
    generateQR(url: args[2], outPath: args[3], size: size, label: label)
case "validate":
    validateQR(path: args[2])
default:
    usage()
}
