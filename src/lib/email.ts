import { Resend } from 'resend';
import { sql } from './db';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'Poppys Chatbot <noreply@jicate.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

export async function sendEmail(params: EmailParams) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    // Log the email
    await sql`
      INSERT INTO email_log (to_email, subject, template, status, related_entity_type, related_entity_id)
      VALUES (${params.to}, ${params.subject}, ${params.template}, 'SENT', ${params.relatedEntityType || null}, ${params.relatedEntityId || null})
    `;

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('Email send failed:', error);

    await sql`
      INSERT INTO email_log (to_email, subject, template, status, related_entity_type, related_entity_id)
      VALUES (${params.to}, ${params.subject}, ${params.template}, 'FAILED', ${params.relatedEntityType || null}, ${params.relatedEntityId || null})
    `;

    return { success: false, error };
  }
}

// Template: Notify Colour Bank Manager of new pending colour
export async function notifyManagerPendingColour(
  managerEmail: string,
  managerName: string,
  creatorName: string,
  colourCode: string,
  colourName: string,
  poNumber: string | null,
  colourId: number
) {
  const reviewUrl = `${APP_URL}/admin/colours`;

  return sendEmail({
    to: managerEmail,
    subject: `[Poppys Chatbot] New colour pending your approval${poNumber ? ` — PO ${poNumber}` : ''}`,
    template: 'manager_pending_colour',
    relatedEntityType: 'colour',
    relatedEntityId: colourId,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #155387; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Poppys Chatbot</h1>
        </div>
        <div style="padding: 24px; background: white;">
          <p>Hello ${managerName},</p>
          <p>${creatorName} has added a new colour to the Colour Bank:</p>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Code:</strong> ${colourCode}</p>
            <p style="margin: 4px 0;"><strong>Proposed name:</strong> ${colourName}</p>
            ${poNumber ? `<p style="margin: 4px 0;"><strong>Source PO:</strong> ${poNumber}</p>` : ''}
          </div>
          <p>Please review and approve or reject this colour.</p>
          <a href="${reviewUrl}" style="display: inline-block; background: #155387; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Review Now</a>
        </div>
        <div style="padding: 16px; text-align: center; color: #787878; font-size: 12px;">
          Poppys Chatbot • Jicate Solutions
        </div>
      </div>
    `,
    text: `Hello ${managerName},\n\n${creatorName} has added a new colour: ${colourCode} / ${colourName}.\n\nPlease review: ${reviewUrl}`,
  });
}

// Template: Notify PO Approver that PO is ready
export async function notifyApproverPOReady(
  approverEmail: string,
  approverName: string,
  creatorName: string,
  poNumber: string,
  vendorName: string,
  poId: number
) {
  const reviewUrl = `${APP_URL}/admin/approvals`;

  return sendEmail({
    to: approverEmail,
    subject: `[Poppys Chatbot] PO ${poNumber} is ready for your approval`,
    template: 'approver_po_ready',
    relatedEntityType: 'po',
    relatedEntityId: poId,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #155387; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Poppys Chatbot</h1>
        </div>
        <div style="padding: 24px; background: white;">
          <p>Hello ${approverName},</p>
          <p>PO <strong>${poNumber}</strong> has been submitted by ${creatorName} and all colours are now ACTIVE. The PO is ready for your approval.</p>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>PO:</strong> ${poNumber}</p>
            <p style="margin: 4px 0;"><strong>Vendor:</strong> ${vendorName}</p>
          </div>
          <a href="${reviewUrl}" style="display: inline-block; background: #155387; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Review Now</a>
        </div>
        <div style="padding: 16px; text-align: center; color: #787878; font-size: 12px;">
          Poppys Chatbot • Jicate Solutions
        </div>
      </div>
    `,
    text: `Hello ${approverName},\n\nPO ${poNumber} (Vendor: ${vendorName}) is ready for your approval.\n\nReview: ${reviewUrl}`,
  });
}

// Template: Notify Creator that colour was rejected
export async function notifyCreatorColourRejected(
  creatorEmail: string,
  creatorName: string,
  colourCode: string,
  colourName: string,
  reason: string,
  poNumber: string | null
) {
  return sendEmail({
    to: creatorEmail,
    subject: `[Poppys Chatbot] Colour ${colourCode} rejected${poNumber ? ` — PO ${poNumber} blocked` : ''}`,
    template: 'creator_colour_rejected',
    relatedEntityType: 'colour',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #155387; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Poppys Chatbot</h1>
        </div>
        <div style="padding: 24px; background: white;">
          <p>Hello ${creatorName},</p>
          <p>The Colour Bank Manager has <span style="color: #942e2e; font-weight: bold;">rejected</span> your colour:</p>
          <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Code:</strong> ${colourCode}</p>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${colourName}</p>
            <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
          </div>
          ${poNumber ? `<p>Your PO <strong>${poNumber}</strong> is currently blocked. Please correct the affected line and resubmit.</p>` : ''}
          <a href="${APP_URL}" style="display: inline-block; background: #155387; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Review Now</a>
        </div>
        <div style="padding: 16px; text-align: center; color: #787878; font-size: 12px;">
          Poppys Chatbot • Jicate Solutions
        </div>
      </div>
    `,
    text: `Hello ${creatorName},\n\nYour colour ${colourCode} / ${colourName} has been rejected.\nReason: ${reason}\n\n${poNumber ? `PO ${poNumber} is blocked.` : ''}`,
  });
}
