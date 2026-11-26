import TableModule from './base.module.js';
import db from '../connection.js';
class AttachmentModule extends TableModule {
  constructor(){super('request_attachments',['id','request_id','original_filename','mime_type','file_size_bytes','created_at']);}
  list(requestId,userId,staff,page) {
    const query=db(this.table).select(this.columns).where('request_id',requestId);
    if(!staff) query.where('uploaded_by_id',userId);
    return query.orderBy('id').limit(page.limit).offset(page.offset);
  }
}
export default new AttachmentModule();
