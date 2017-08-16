import {
  Component, Output, EventEmitter, Input, HostBinding, ViewChild, OnInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { translateXY, columnsByPin, columnGroupWidths, RowHeightCache } from '../../utils';
import { SelectionType } from '../../types';
import { ScrollerComponent } from './scroller.component';
import { mouseEvent } from '../../events';

//      [groupRowsBy]="groupRowsBy"
@Component({
  selector: 'datatable-body',
  template: `
    <datatable-selection
      #selector
      [selected]="selected"
      [rows]="temp"
      [selectCheck]="selectCheck"
      [selectEnabled]="selectEnabled"
      [selectionType]="selectionType"
      [rowIdentity]="rowIdentity"
      (select)="select.emit($event)"
      (activate)="activate.emit($event)">
      <datatable-progress
        *ngIf="loadingIndicator">
      </datatable-progress>
      <datatable-scroller
        *ngIf="rows?.length"
        [scrollbarV]="scrollbarV"
        [scrollbarH]="scrollbarH"
        [scrollHeight]="scrollHeight"
        [scrollWidth]="columnGroupWidths.total"
        (scroll)="onBodyScroll($event)">
        <datatable-row-wrapper
          [groupedRows]="groupedRows"
          *ngFor="let group of temp; let i = index; trackBy: rowTrackingFn;"
          [ngStyle]="getRowsStyles(group)"
          [rowDetail]="rowDetail"
          [detailRowHeight]="getDetailRowHeight(group[i],i)"
          [row]="group"
          [expanded]="getRowExpanded(group)"
          [rowIndex]="getRowIndex(group[i])"
          (rowContextmenu)="rowContextmenu.emit($event)">
          <table style="width: 100%">
          <tr>
          <td>
          <datatable-body-row *ngIf="!group.value"        
            tabindex="-1"
            [isSelected]="selector.getRowSelected(group)"
            [innerWidth]="innerWidth"
            [offsetX]="offsetX"
            [columns]="columns"
            [rowHeight]="getRowHeight(group)"
            [row]="group"
            [rowIndex]="getRowIndex(group)"
            [expanded]="getRowExpanded(group)"            
            [rowClass]="rowClass"
            (activate)="selector.onActivate($event, i)">
          </datatable-body-row>                       
          <datatable-body-row
            *ngFor="let row of group.value; let i = index; trackBy: rowTrackingFn;"
            tabindex="-1"
            [isSelected]="selector.getRowSelected(row)"
            [innerWidth]="innerWidth"
            [offsetX]="offsetX"
            [columns]="columns"
            [rowHeight]="getRowHeight(row)"
            [row]="row"
            [group]="group.value"
            [rowIndex]="getRowIndex(row)"
            [expanded]="getRowExpanded(row)"
            [rowClass]="rowClass"
            (activate)="selector.onActivate($event, i)">
          </datatable-body-row>
          </td>
          <td *ngIf="groupColumns">
            <datatable-body-row *ngIf="group.value"
              tabindex="-1"
              [isSelected]="selector.getRowSelected(group.value[0])"
              [innerWidth]="innerWidth"
              [offsetX]="offsetX"
              [columns]="groupColumns"
              [rowHeight]="getRowHeight(group)"
              [row]="group.value[0]"
              [group]="group.value"
              [rowClass]="rowClass"
              (activate)="selector.onActivate($event, i)">
            </datatable-body-row>              
          </td>              
          </tr>
          </table>      
        </datatable-row-wrapper>
      </datatable-scroller>
      <div
        class="empty-row"
        *ngIf="!rows?.length"
        [innerHTML]="emptyMessage">
      </div>
    </datatable-selection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'datatable-body'
  }
})
export class DataTableBodyComponent implements OnInit, OnDestroy {
  @Input() scrollbarV: boolean;
  @Input() scrollbarH: boolean;
  @Input() loadingIndicator: boolean;
  @Input() externalPaging: boolean;
  @Input() rowHeight: number;
  @Input() offsetX: number;
  @Input() emptyMessage: string;
  @Input() selectionType: SelectionType;
  @Input() selected: any[] = [];
  @Input() rowIdentity: any;
  @Input() rowDetail: any;
  @Input() selectCheck: any;
  @Input() trackByProp: string;
  @Input() rowClass: any;
  @Input() groupedRows: any;

  _groupRowsBy: string;
  _groupColumns: Array<any>;
  _innerWidth: number;

  @Input() set groupRowsBy(val: string){
    this._groupRowsBy = val
  }

  get groupRowsBy(): string{
    return this._groupRowsBy;
  }

  @Input() set pageSize(val: number) {
    this._pageSize = val;
    this.recalcLayout();
  }

  get pageSize(): number {
    return this._pageSize;
  }

  @Input() set rows(val: any[]) {
    this._rows = val;
    this.rowExpansions.clear();
    this.recalcLayout();
  }

  get rows(): any[] {
    return this._rows;
  }

  @Input() set columns(val: any[]) {
    //don't add group columns to _columns because they are dealt with through a subsequent call of datatable-body-row using groupColumns
    this._columns = val.filter(column => !column.isGroup);

    this._groupColumns = []; //clear the group array
    for (var i=0; i< val.length; i++) {
      if (val[i].isGroup)
        {
          this._groupColumns.push(val[i]);
        }              
    }

    const colsByPin = columnsByPin(val);
    this.columnGroupWidths = columnGroupWidths(colsByPin, val);    

  }

  get groupColumns(): Array<any>{
    return this._groupColumns;
  }

  get columns(): any[] {
    return this._columns;
  }

  @Input() set offset(val: number) {
    this._offset = val;
    this.recalcLayout();
  }

  get offset(): number {
    return this._offset;
  }

  @Input() set rowCount(val: number) {
    this._rowCount = val;
    this.recalcLayout();
  }

  get rowCount(): number {
    return this._rowCount;
  }  

  @Input() set innerWidth(val: number)
  {
    this._innerWidth = val
  };

  get innerWidth(): number{
    return this._innerWidth
  }

/*
     
*/
  @HostBinding('style.width')
  get bodyWidth(): string {
    if (this.scrollbarH) {
      return this.innerWidth + 'px';
    } else {
      return '100%';
    }
  }

  @Input()
  @HostBinding('style.height')
  set bodyHeight(val) {
    if (this.scrollbarV) {
      this._bodyHeight = val + 'px';
    } else {
      this._bodyHeight = 'auto';
    }

    this.recalcLayout();
  }

  get bodyHeight() {
    return this._bodyHeight;
  }

  @Output() scroll: EventEmitter<any> = new EventEmitter();
  @Output() page: EventEmitter<any> = new EventEmitter();
  @Output() activate: EventEmitter<any> = new EventEmitter();
  @Output() select: EventEmitter<any> = new EventEmitter();
  @Output() detailToggle: EventEmitter<any> = new EventEmitter();
  @Output() rowContextmenu = new EventEmitter<{ event: MouseEvent, row: any }>(false);

  @ViewChild(ScrollerComponent) scroller: ScrollerComponent;

  /**
   * Returns if selection is enabled.
   *
   * @readonly
   * @type {boolean}
   * @memberOf DataTableBodyComponent
   */
  get selectEnabled(): boolean {
    return !!this.selectionType;
  }

  /**
   * Property that would calculate the height of scroll bar
   * based on the row heights cache for virtual scroll. Other scenarios
   * calculate scroll height automatically (as height will be undefined).
   *
   * @readonly
   * @type {number}
   * @memberOf DataTableBodyComponent
   */
  get scrollHeight(): number {
    if (this.scrollbarV) {
      return this.rowHeightsCache.query(this.rowCount - 1);
    }
  }

  set temp(val) {
    this._temp = val;
  }

  get temp() {
    return this._temp;
  }

  rowHeightsCache: RowHeightCache = new RowHeightCache();
  _temp: any[] = [];
  offsetY: number = 0;
  indexes: any = {};
  columnGroupWidths: any;
  columnGroupWidthsWithoutGroup: any;
  rowTrackingFn: any;
  listener: any;
  rowIndexes: any = new Map();
  rowExpansions: any = new Map();

  _rows: any[];
  _bodyHeight: any;
  _columns: any[];
  _rowCount: number;
  _offset: number;
  _pageSize: number;


  /**
   * Creates an instance of DataTableBodyComponent.
   *
   * @memberOf DataTableBodyComponent
   */
  constructor() {
    // declare fn here so we can get access to the `this` property
    this.rowTrackingFn = function(index: number, row: any): any {
      const idx = this.rowIndexes.get(row);
      
      if (this.trackByProp) {
        return `${idx}-${this.trackByProp}`;
      } else {
        return idx;
      }
    }.bind(this);

  }

  /**
   * Called after the constructor, initializing input properties
   *
   * @memberOf DataTableBodyComponent
   */
  ngOnInit(): void {
    if (this.rowDetail) {
      this.listener = this.rowDetail.toggle
        .subscribe(({ type, value }: { type: string, value: any }) => {
          if (type === 'row') this.toggleRowExpansion(value);
          if (type === 'all') this.toggleAllRows(value);
        });
    }
  }

  /**
   * Called once, before the instance is destroyed.
   *
   * @memberOf DataTableBodyComponent
   */
  ngOnDestroy(): void {
    if (this.rowDetail) this.listener.unsubscribe();
  }

  /**
   * Updates the Y offset given a new offset.
   *
   * @param {number} [offset]
   *
   * @memberOf DataTableBodyComponent
   */
  updateOffsetY(offset?: number): void {
    // scroller is missing on empty table
    if (!this.scroller) return;

    if (this.scrollbarV && offset) {
      // First get the row Index that we need to move to.
      const rowIndex = this.pageSize * offset;
      offset = this.rowHeightsCache.query(rowIndex - 1);
    }

    this.scroller.setOffset(offset || 0);
  }

  /**
   * Body was scrolled, this is mainly useful for
   * when a user is server-side pagination via virtual scroll.
   *
   * @param {*} event
   *
   * @memberOf DataTableBodyComponent
   */
  onBodyScroll(event: any): void {
    const scrollYPos: number = event.scrollYPos;
    const scrollXPos: number = event.scrollXPos;

    // if scroll change, trigger update
    // this is mainly used for header cell positions
    if (this.offsetY !== scrollYPos || this.offsetX !== scrollXPos) {
      this.scroll.emit({
        offsetY: scrollYPos,
        offsetX: scrollXPos
      });
    }

    this.offsetY = scrollYPos;
    this.offsetX = scrollXPos;

    this.updateIndexes();
    this.updatePage(event.direction);
    this.updateRows();
  }

  /**
   * Updates the page given a direction.
   *
   * @param {string} direction
   *
   * @memberOf DataTableBodyComponent
   */
  updatePage(direction: string): void {
    let offset = this.indexes.first / this.pageSize;

    if (direction === 'up') {
      offset = Math.ceil(offset);
    } else if (direction === 'down') {
      offset = Math.ceil(offset);
    }

    if (direction !== undefined && !isNaN(offset)) {
      this.page.emit({ offset });
    }
  }

  /**
   * Updates the rows in the view port
   *
   * @memberOf DataTableBodyComponent
   */
  updateRows(): void {
    const { first, last } = this.indexes;
    let rowIndex = first;
    let idx = 0;
    const temp: any[] = [];

  //if grouprowsby has been specified treat row paging parameters as group paging parameters
  //ie if limit 10 has been specified treat it as 10 groups rather than 10 rows    
    if(this.groupedRows)
    {
      var maxRowsPerGroup = 3;

      //if there is only one group set the maximum number of rows per group the same as the total number of rows
        if (this.groupedRows.length==1){
          maxRowsPerGroup = this.groupedRows[0].value.length
        }

        while (rowIndex < last && rowIndex < this.groupedRows.length) {

          //Add the groups into this page
          const group = this.groupedRows[rowIndex];

          if(group) {
            //row.$$index = rowIndex + (rowIndex*maxRowsPerGroup);
            temp[idx] = group;
          }

          idx++;
          rowIndex++; //Group index
        }      
      }
      else
      {

        this.rowIndexes.clear();

        while (rowIndex < last && rowIndex < this.rowCount) {
          const row = this.rows[rowIndex];

          if (row) {
            this.rowIndexes.set(row, rowIndex);
            temp[idx] = row;
          }

          idx++;
          rowIndex++;
        }       
      }
    
    this.temp = temp;   
  }

  /**
   * Get the row height
   *
   * @param {*} row
   * @returns {number}
   *
   * @memberOf DataTableBodyComponent
   */
  getRowHeight(row: any): number {
    let rowHeight = this.rowHeight;  

    // if its a function return it
    if (typeof this.rowHeight === 'function') {
      rowHeight = this.rowHeight(row);
    }

    return rowHeight;
  }

  /**
   * Calculate row height based on the expanded state of the row.
   *
   * @param {*} row the row for which the height need to be calculated.
   * @returns {number} height of the row.
   *
   * @memberOf DataTableBodyComponent
   */
  getRowAndDetailHeight(row: any): number {
    let rowHeight = this.getRowHeight(row);
    const expanded = this.rowExpansions.get(row);

    // Adding detail row height if its expanded.
    if (expanded === 1) {
      rowHeight += this.getDetailRowHeight(row);
    }

    return rowHeight;
  }

  /**
   * Get the height of the detail row.
   *
   * @param {*} [row]
   * @param {*} [index]
   * @returns {number}
   *
   * @memberOf DataTableBodyComponent
   */
  getDetailRowHeight = (row?: any, index?: any): number => {
    if (!this.rowDetail) return 0;
    const rowHeight = this.rowDetail.rowHeight;
    return typeof rowHeight === 'function' ? rowHeight(row, index) : rowHeight;
  }

  /**
   * Calculates the styles for the row so that the rows can be moved in 2D space
   * during virtual scroll inside the DOM.   In the below case the Y position is
   * manipulated.   As an example, if the height of row 0 is 30 px and row 1 is
   * 100 px then following styles are generated:
   *
   * transform: translate3d(0px, 0px, 0px);    ->  row0
   * transform: translate3d(0px, 30px, 0px);   ->  row1
   * transform: translate3d(0px, 130px, 0px);  ->  row2
   *
   * Row heights have to be calculated based on the row heights cache as we wont
   * be able to determine which row is of what height before hand.  In the above
   * case the positionY of the translate3d for row2 would be the sum of all the
   * heights of the rows before it (i.e. row0 and row1).
   * 
   * @param {*} rows The row that needs to be placed in the 2D space.
   * @returns {*} Returns the CSS3 style to be applied
   *
   * @memberOf DataTableBodyComponent
   */
  
  getRowsStyles(rows: any): any {
    var rowHeight=0;
    var styles = {};

    //check if it's a group
    if (rows)
      {
      if (rows.value){
        for (var index = 0; index < rows.value.length; index++) {
          rowHeight += this.getRowAndDetailHeight(rows.value[index]);     
        }          
      }  
      else{
        rowHeight += this.getRowAndDetailHeight(rows);
      }

      styles = {
        height: rowHeight + 'px'
      };

      //only add styles for the group if there is a group
      if (this.groupedRows){
        styles['border-bottom'] = '1px solid black';
        styles['width'] = this.columnGroupWidths.total;
      }
      if(this.scrollbarV) {
        var idx = 0

        if (this.groupedRows){
          idx = rows[rows.length-1] ? rows[rows.length-1].$$index : 0;
        }
        else{
          idx = this.rowIndexes.get(rows) || 0;
        }        

        // const pos = idx * rowHeight;
        // The position of this row would be the sum of all row heights
        // until the previous row position.
        const pos = this.rowHeightsCache.query(idx - 1);

        translateXY(styles, 0, pos);
      }
    }
    return styles;
  }
 
  /**
   * Hides the loading indicator
   *
   *
   * @memberOf DataTableBodyComponent
   */
  hideIndicator(): void {
    setTimeout(() => this.loadingIndicator = false, 500);
  }

  /**
   * Updates the index of the rows in the viewport
   *
   * @memberOf DataTableBodyComponent
   */
  updateIndexes(): void {
    let first = 0;
    let last = 0;

    if (this.scrollbarV) {
      // Calculation of the first and last indexes will be based on where the
      // scrollY position would be at.  The last index would be the one
      // that shows up inside the view port the last.
      const height = parseInt(this.bodyHeight, 0);
      first = this.rowHeightsCache.getRowIndex(this.offsetY);
      last = this.rowHeightsCache.getRowIndex(height + this.offsetY) + 1;
    } else {
      // The server is handling paging and will pass an array that begins with the
      // element at a specified offset.  first should always be 0 with external paging.
      if (!this.externalPaging) {
        first = Math.max(this.offset * this.pageSize, 0);
      }
      last = Math.min((first + this.pageSize), this.rowCount);
    }

    this.indexes = { first, last };
  }

  /**
   * Refreshes the full Row Height cache.  Should be used
   * when the entire row array state has changed.
   *
   * @returns {void}
   *
   * @memberOf DataTableBodyComponent
   */
  refreshRowHeightCache(): void {
    if (!this.scrollbarV) return;

    // clear the previous row height cache if already present.
    // this is useful during sorts, filters where the state of the
    // rows array is changed.
    this.rowHeightsCache.clearCache();

    // Initialize the tree only if there are rows inside the tree.
    if (this.rows && this.rows.length) {
      this.rowHeightsCache.initCache({
        rows: this.rows,
        rowHeight: this.rowHeight,
        detailRowHeight: this.getDetailRowHeight,
        externalVirtual: this.scrollbarV && this.externalPaging,
        rowCount: this.rowCount,
        rowIndexes: this.rowIndexes,
        rowExpansions: this.rowExpansions
      });
    }
  }

  /**
   * Gets the index for the view port
   *
   * @returns {number}
   *
   * @memberOf DataTableBodyComponent
   */
  getAdjustedViewPortIndex(): number {
    // Capture the row index of the first row that is visible on the viewport.
    // If the scroll bar is just below the row which is highlighted then make that as the
    // first index.
    const viewPortFirstRowIndex = this.indexes.first;

    if (this.scrollbarV) {
      const offsetScroll = this.rowHeightsCache.query(viewPortFirstRowIndex - 1);
      return offsetScroll <= this.offsetY ? viewPortFirstRowIndex - 1 : viewPortFirstRowIndex;
    }

    return viewPortFirstRowIndex;
  }

  /**
   * Toggle the Expansion of the row i.e. if the row is expanded then it will
   * collapse and vice versa.   Note that the expanded status is stored as
   * a part of the row object itself as we have to preserve the expanded row
   * status in case of sorting and filtering of the row set.
   *
   * @param {*} row The row for which the expansion needs to be toggled.
   *
   * @memberOf DataTableBodyComponent
   */
  toggleRowExpansion(row: any): void {
    // Capture the row index of the first row that is visible on the viewport.
    const viewPortFirstRowIndex = this.getAdjustedViewPortIndex();
    let expanded = this.rowExpansions.get(row);

    // If the detailRowHeight is auto --> only in case of non-virtualized scroll
    if (this.scrollbarV) {
      const detailRowHeight = this.getDetailRowHeight(row) * (expanded ? -1 : 1);
      const idx = this.rowIndexes.get(row) || 0;
      this.rowHeightsCache.update(idx, detailRowHeight);
    }

    // Update the toggled row and update thive nevere heights in the cache.
    expanded = expanded ^= 1;
    this.rowExpansions.set(row, expanded);

    this.detailToggle.emit({
      rows: [row],
      currentIndex: viewPortFirstRowIndex
    });
  }

  /**
   * Expand/Collapse all the rows no matter what their state is.
   *
   * @param {boolean} expanded When true, all rows are expanded and when false, all rows will be collapsed.
   *
   * @memberOf DataTableBodyComponent
   */
  toggleAllRows(expanded: boolean): void {
    // clear prev expansions
    this.rowExpansions.clear();

    const rowExpanded = expanded ? 1 : 0;

    // Capture the row index of the first row that is visible on the viewport.
    const viewPortFirstRowIndex = this.getAdjustedViewPortIndex();

    for (const row of this.rows) {
      this.rowExpansions.set(row, rowExpanded);
    }

    if (this.scrollbarV) {
      // Refresh the full row heights cache since every row was affected.
      this.recalcLayout();
    }

    // Emit all rows that have been expanded.
    this.detailToggle.emit({
      rows: this.rows,
      currentIndex: viewPortFirstRowIndex
    });
  }

  /**
   * Recalculates the table
   *
   * @memberOf DataTableBodyComponent
   */
  recalcLayout(): void {
    this.refreshRowHeightCache();
    this.updateIndexes();
    this.updateRows();
  }

  columnTrackingFn(index: number, column: any): any {
    return column.$$id;
  }

  stylesByGroup(group: string) {
    const widths = this.columnGroupWidths;
    const offsetX = this.offsetX;

    const styles = {
      width: `${widths[group]}px`
    };

    if(group === 'left') {
      translateXY(styles, offsetX, 0);
    } else if(group === 'right') {
      const bodyWidth = parseInt(this.innerWidth + '', 0);
      const totalDiff = widths.total - bodyWidth;
      const offsetDiff = totalDiff - offsetX;
      const offset = offsetDiff * -1;
      translateXY(styles, offset, 0);
    }

    return styles;
  }
  
  /**
   * Returns if the row was expanded
   * 
   * @param {*} row 
   * @returns {boolean} 
   * @memberof DataTableBodyComponent
   */
  getRowExpanded(row: any): boolean {
    const expanded = this.rowExpansions.get(row);
    return expanded === 1;
  }

  /**
   * Gets the row index of the item
   * 
   * @param {*} row 
   * @returns {number} 
   * @memberof DataTableBodyComponent
   */
  getRowIndex(row: any): number {
    return this.rowIndexes.get(row);
  }  
}

/**
 * 
 * @param key the element key, unique content
 * @param value the element value, it can be single content or an array
 */
function addGroup(key, value) {
  return { "key": key, "value": value };
}




