from fastapi import FastAPI, UploadFile, File
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from fastapi import Form
from predictor import predict_storage
import shutil
import os
import io
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_FOLDER = "uploads"

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    plan: str = Form("Pro")
):

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    if plan == "Free":
        rate = 1
    elif plan == "Pro":
        rate = 2
    elif plan == "Enterprise":
        rate = 3
    else:
        rate = 2

    cost = (file_size / (1024 * 1024)) * rate

    with engine.connect() as conn:
        conn.execute(
            text(
                "INSERT INTO usage_logs (filename, filesize, plan) VALUES (:filename, :filesize, :plan)"
            ),
            {
                "filename": file.filename,
                "filesize": file_size,
                "plan": plan,
            }
        )

        conn.commit()

    return {
        "message": "File uploaded successfully",
        "filename": file.filename,
        "size": file_size,
        "estimated_cost": round(cost, 2)
    }
@app.get("/usage")
def get_usage():

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT * FROM usage_logs")
        )

        rows = result.fetchall()

    data = []

    for row in rows:
        data.append({
            "id": row.id,
            "filename": row.filename,
            "filesize": row.filesize,
            "plan": row.plan,
            "uploaded_at": str(row.uploaded_at)
        })

    return data
@app.get("/summary")
def get_summary():

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs")
        )

        total_size = result.scalar()

    if total_size is None:
        total_size = 0

    total_cost = (total_size / (1024 * 1024)) * 2

    return {
        "total_storage_bytes": total_size,
        "total_cost": round(total_cost, 2)
    }
    
    
@app.get("/forecast")
def forecast():
    with engine.connect() as conn:
        result = conn.execute(
            text("""
            SELECT filesize
            FROM usage_logs
            ORDER BY uploaded_at
            """)
        )
        rows = result.fetchall()

    storage_history = []
    running_total = 0
    for row in rows:
        mb = row[0] / (1024 * 1024)
        running_total += mb
        storage_history.append(running_total)

    if len(storage_history) < 2:
        predicted_storage = storage_history[0] if storage_history else 0.0
    else:
        predicted_storage = predict_storage(storage_history)
        
    predicted_cost = predicted_storage * 2

    return {
        "predicted_storage_mb": round(predicted_storage, 2),
        "predicted_cost": round(predicted_cost, 2)
    }
@app.get("/recommend-tier")
def recommend_tier():

    print("RECOMMEND ENDPOINT HIT")

    with engine.connect() as conn:

        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs")
        )

        total_bytes = result.scalar()

    if total_bytes is None:
        total_bytes = 0

    total_mb = total_bytes / (1024 * 1024)

    if total_mb < 100:
        recommendation = "Free"
        reason = "Current storage usage fits within Free plan limits."
    elif total_mb < 500:
        recommendation = "Pro"
        reason = "Current storage usage fits within Pro plan limits."
    else:
        recommendation = "Enterprise"
        reason = "Storage usage is approaching enterprise scale."

    return {
        "current_storage_mb": round(total_mb, 2),
        "recommended_plan": recommendation,
        "reason": reason
    }


@app.get("/alerts")
def get_alerts():
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT plan FROM usage_logs ORDER BY uploaded_at DESC LIMIT 1")
        )
        row = result.fetchone()
        current_plan = row[0] if row else "Free"

        result = conn.execute(
            text("SELECT filesize FROM usage_logs ORDER BY uploaded_at")
        )
        rows = result.fetchall()

    storage_history = []
    running_total = 0
    for row in rows:
        mb = row[0] / (1024 * 1024)
        running_total += mb
        storage_history.append(running_total)

    if len(storage_history) < 2:
        forecasted_storage_mb = storage_history[0] if storage_history else 0.0
    else:
        forecasted_storage_mb = predict_storage(storage_history)

    forecasted_storage_mb = round(forecasted_storage_mb, 2)

    plan_limits = {
        "Free": 100.0,
        "Pro": 500.0,
        "Enterprise": 1000.0
    }
    limit_mb = plan_limits.get(current_plan, 100.0)

    if forecasted_storage_mb > limit_mb:
        alert = True
        severity = "critical"
        message = "Forecasted usage is expected to exceed the current plan limit."
    elif forecasted_storage_mb >= 0.8 * limit_mb:
        alert = True
        severity = "warning"
        message = "Forecasted usage is expected to approach the current plan limit."
    else:
        alert = False
        severity = "none"
        message = "Usage is within safe limits."

    if alert:
        if forecasted_storage_mb < 100:
            recommended_plan = "Free"
        elif forecasted_storage_mb < 500:
            recommended_plan = "Pro"
        else:
            recommended_plan = "Enterprise"

        return {
            "alert": True,
            "severity": severity,
            "current_plan": current_plan,
            "plan_limit_mb": int(limit_mb),
            "forecasted_storage_mb": forecasted_storage_mb,
            "recommended_plan": recommended_plan,
            "message": message
        }
    else:
        return {
            "alert": False,
            "severity": "none",
            "message": message
        }


@app.get("/invoice")
def get_invoice():
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT plan FROM usage_logs ORDER BY uploaded_at DESC LIMIT 1")
        )
        row = result.fetchone()
        plan = row[0] if row else "Free"

        result = conn.execute(
            text("SELECT COUNT(*) FROM usage_logs")
        )
        total_files = result.scalar() or 0

        result = conn.execute(
            text("SELECT SUM(filesize) FROM usage_logs")
        )
        total_bytes = result.scalar() or 0

    storage_used_mb = round(total_bytes / (1024 * 1024), 2)
    plan_rates = {
        "Free": 1,
        "Pro": 2,
        "Enterprise": 3
    }
    rate_per_mb = plan_rates.get(plan, 2)
    total_amount = round(storage_used_mb * rate_per_mb, 2)

    from datetime import datetime
    now = datetime.now()
    billing_period = now.strftime("%B %Y")
    generated_at = now.strftime("%Y-%m-%d")
    invoice_id = f"INV-{now.strftime('%Y')}-{total_files:04d}"

    return {
        "invoice_id": invoice_id,
        "billing_period": billing_period,
        "plan": plan,
        "total_files": total_files,
        "storage_used_mb": storage_used_mb,
        "rate_per_mb": rate_per_mb,
        "total_amount": total_amount,
        "generated_at": generated_at
    }


def generate_pdf_invoice(invoice_data: dict) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=25
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4f46e5'),
        spaceBefore=15,
        spaceAfter=10
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569')
    )
    
    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1e293b')
    )
    
    total_label_style = ParagraphStyle(
        'TotalLabelStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b')
    )
    
    total_val_style = ParagraphStyle(
        'TotalValStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#4f46e5')
    )

    elements = []
    
    # Title & Header Banner
    elements.append(Paragraph("SaaS Storage Billing Invoice", title_style))
    elements.append(Paragraph(f"Invoice Statement for your cloud storage consumption.", subtitle_style))
    
    # General Info Table
    info_data = [
        [Paragraph("Invoice ID:", label_style), Paragraph(invoice_data["invoice_id"], value_style),
         Paragraph("Billing Period:", label_style), Paragraph(invoice_data["billing_period"], value_style)],
        [Paragraph("Generated Date:", label_style), Paragraph(invoice_data["generated_at"], value_style),
         Paragraph("Customer Plan:", label_style), Paragraph(invoice_data["plan"], value_style)]
    ]
    
    t_info = Table(info_data, colWidths=[110, 150, 110, 150])
    t_info.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 20))
    
    # Line Items Section
    elements.append(Paragraph("Usage Summary Details", section_heading))
    
    # Details Grid Table
    details_data = [
        [Paragraph("Usage Metric", label_style), Paragraph("Quantity / Details", label_style), Paragraph("Unit Cost / Rate", label_style)],
        [Paragraph("Storage Consumed", value_style), Paragraph(f"{invoice_data['storage_used_mb']} MB", value_style), Paragraph(f"₹{invoice_data['rate_per_mb']} / MB", value_style)],
        [Paragraph("Total Metered Files", value_style), Paragraph(f"{invoice_data['total_files']} files", value_style), Paragraph("Included in plan", value_style)]
    ]
    
    t_details = Table(details_data, colWidths=[200, 160, 160])
    t_details.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('LINEBELOW', (0,0), (-1,0), 1.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#f1f5f9')),
    ]))
    elements.append(t_details)
    elements.append(Spacer(1, 25))
    
    # Total Due Box (Amount Due Banner)
    elements.append(Paragraph("Payment Summary", section_heading))
    total_data = [
        [Paragraph("Total Subtotal:", label_style), Paragraph(f"₹{invoice_data['total_amount']}", value_style)],
        [Paragraph("Tax / GST (0%):", label_style), Paragraph("₹0.00", value_style)],
        [Paragraph("Amount Due:", total_label_style), Paragraph(f"₹{invoice_data['total_amount']}", total_val_style)]
    ]
    
    t_total = Table(total_data, colWidths=[150, 150])
    t_total.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (1,1), 0.5, colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0,2), (1,2), colors.HexColor('#f0f9ff')),
        ('BOX', (0,2), (1,2), 1, colors.HexColor('#bae6fd')),
        ('TOPPADDING', (0,2), (1,2), 12),
        ('BOTTOMPADDING', (0,2), (1,2), 12),
    ]))
    
    # Position total block on the right-ish side by padding left
    t_total_container = Table([[Spacer(1,1), t_total]], colWidths=[220, 300])
    t_total_container.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT')
    ]))
    
    elements.append(t_total_container)
    elements.append(Spacer(1, 40))
    
    # Footer Notice
    footer_text = ParagraphStyle(
        'FooterNotice',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=12,
        textColor=colors.HexColor('#94a3b8'),
        alignment=1 # Centered
    )
    elements.append(Paragraph("Thank you for using our Object Storage SaaS service. If you have any questions, please contact billing-support@saasbox.com.", footer_text))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


@app.get("/invoice/download")
def download_invoice():
    invoice_data = get_invoice()
    pdf_buffer = generate_pdf_invoice(invoice_data)
    filename = f"invoice_{invoice_data['invoice_id']}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
